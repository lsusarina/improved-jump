import {
  AbstractMesh,
  Axis,
  CreateDecal,
  Mesh,
  Scene,
  SceneLoader,
  UniversalCamera,
  Vector3,
  StandardMaterial,
  CreateSphere,
  Animation,
  Ray,
} from "@babylonjs/core";
import { PhysicsImpostor } from "@babylonjs/core/Physics/v1/physicsImpostor";
import {
  AdvancedDynamicTexture,
  Control,
  Image,
  TextBlock,
} from "@babylonjs/gui";

class PlayerController {
  /**
   * Двигается ли игрок вперед?
   */
  private _movingForward = false;

  /**
   * Двигается ли игрок назад?
   */
  private _movingBack = false;

  /**
   * Двигается ли игрок влево?
   */
  private _movingLeft = false;

  /**
   * Двигается ли игрок вправо?
   */
  private _movingRight = false;

  /**
   * Меш игрока (моделька)
   */
  private _playerMesh: AbstractMesh;

  /**
   * Рост игрока
   */
  private _characterHeight = 1.8;

  private _characterHealth = 100;

  /**
   * Бежит ли игрок?
   */
  private _isRunning = false;

  private _isJumping = false;

  private _canJump = false;

  /**
   * Оружие игрока
   */
  private _weapon: AbstractMesh;

  /**
   * Прицелился ли игрок?
   */
  private _isZooming = false;

  /**
   * Скорость ходьбы
   */
  private _walkSpeed = 10;

  /**
   * Скорость бега
   */
  private _runSpeed = 25;

  /**
   * Массив материалов, которыми игрок может "стрелять" (используется для декалей)
   */
  private _splatters: StandardMaterial[];

  private _camera: UniversalCamera;

  private _hpText: TextBlock;

  private _damageIndicator: Image;

  /**
   * "Обертка" игрока. Меш, который будет передвигаться по сцене с помощью кнопок управления
   */
  private _playerWrapper: AbstractMesh;

  _scene: Scene;

  constructor(
    camera: UniversalCamera,
    playerMesh: Mesh,
    splatters: StandardMaterial[],
    scene: Scene
  ) {
    this._scene = scene;

    this._splatters = splatters;

    this._playerMesh = playerMesh;

    this._camera = camera;
    this._camera.position.y = this._characterHeight;

    this._playerWrapper = CreateSphere("player-wrapper", {
      diameter: 1,
      diameterY: this._characterHeight,
    });

    this._playerWrapper.position = new Vector3(
      0,
      this._characterHeight / 2,
      -10
    );

    this._playerWrapper.physicsImpostor = new PhysicsImpostor(
      this._playerWrapper,
      PhysicsImpostor.SphereImpostor,
      {
        mass: 50,
        friction: 0,
      }
    );

    this._playerWrapper.physicsImpostor.physicsBody.angularDamping = 1;

    this._camera.parent = this._playerWrapper;

    this._playerMesh.setParent(this._playerWrapper);

    this._playerMesh.position = new Vector3(
      this._playerMesh.position.x,
      this._characterHeight / 2,
      0
    );

    this._playerMesh.isVisible = false;

    this._listenEvents();
    this._calculateMovement();
    this._calculateShoot();
  }

  async loadWeapon(path: string, filename: string, offset: Vector3) {
    const { meshes } = await SceneLoader.ImportMeshAsync("", path, filename);

    this._weapon = meshes[0];
    this._weapon.parent = this._camera;
    this._weapon.position = offset;
  }

  private _calculateMovement() {
    let once = false;

    this._scene.registerBeforeRender(() => {
      const cameraDirection = this._camera.getDirection(Vector3.Forward());

      const currentSpeed = this._isRunning ? this._runSpeed : this._walkSpeed;

      const currentVelocity =
        this._playerWrapper.physicsImpostor.getLinearVelocity();

      if (this._isRunning && !once) {
        this._weapon.rotate(Axis.Y, -Math.PI / 5);
        once = true;
      } else if (!this._isRunning && once) {
        this._weapon.rotate(Axis.Y, Math.PI / 5);
        once = false;
      }

      let velocity = new Vector3(0, 0, 0);

      if (this._movingForward) {
        velocity = cameraDirection.scale(currentSpeed);
      }

      if (this._movingBack) {
        velocity = cameraDirection.scale(-currentSpeed * 0.6);
      }

      if (this._movingLeft) {
        velocity = cameraDirection.cross(Axis.Y).scale(currentSpeed);
      }

      if (this._movingRight) {
        velocity = cameraDirection.cross(Axis.Y).scale(-currentSpeed);
      }

      if (this._isJumping) {
        this._canJump = this._isGrounded();
        if (this._canJump){
          currentVelocity.y = 10;
        }
      }

      velocity.y = currentVelocity.y;

      this._playerWrapper.physicsImpostor.setLinearVelocity(velocity);
    });
  }

  private _isGrounded() {
    const ray = new Ray(this._playerWrapper.position, Vector3.Down(), 5);

    const pickingInfo = this._scene.pickWithRay(ray);
    console.log(pickingInfo);

    let grounded;
    if (pickingInfo.pickedMesh){
      grounded = true;
    } else {
      grounded = false;
    }
    return grounded;
  }

  private _setUpGUI() {
    const ui = AdvancedDynamicTexture.CreateFullscreenUI("player-ui");

    const damageIndicator = new Image(
      "damage-indicator",
      "./textures/damage-indicator.png"
    );
    damageIndicator.isVisible = false;
    damageIndicator.alpha = 0.5;

    ui.addControl(damageIndicator);

    const hpText = new TextBlock("HP", String(this._characterHealth));
    hpText.fontSize = "40px";
    hpText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    hpText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    hpText.width = "100px";
    hpText.height = "50px";
    hpText.left = 20;
    hpText.top = 20;

    ui.addControl(hpText);

    this._hpText = hpText;
    this._damageIndicator = damageIndicator;
  }

  subtractHealth(x: number) {
    this._characterHealth -= x;

    this._damageIndicator.isVisible = true;

    const damageIndicatorAnimation = new Animation(
      "damage-indicator-animation",
      "alpha",
      20,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const keyFrames = [];
    keyFrames.push({
      frame: 0,
      value: 0.5,
    });

    keyFrames.push({
      frame: 10,
      value: 0.25,
    });

    keyFrames.push({
      frame: 20,
      value: 0,
    });

    damageIndicatorAnimation.setKeys(keyFrames);

    this._damageIndicator.animations = [];
    this._damageIndicator.animations.push(damageIndicatorAnimation);

    this._scene.beginAnimation(this._damageIndicator, 0, 20, false);
  }

  private _calculateShoot() {
    this._scene.onPointerDown = (event) => {
      if (this._isRunning) return;

      // left click (can't find enum)
      if (event.button === 0) {
        const origin = this._playerWrapper
          .getAbsolutePosition()
          .subtract(new Vector3(0, -this._characterHeight, 0));

        const ray = this._camera.getForwardRay(undefined, undefined, origin);

        const raycastHit = this._scene.pickWithRay(ray);

        const cameraDirection = this._camera.getDirection(Vector3.Forward());

        const ball = CreateSphere("ball", { diameter: 0.1 });
        ball.position = origin;

        ball.physicsImpostor = new PhysicsImpostor(
          ball,
          PhysicsImpostor.SphereImpostor,
          {
            mass: 0.5,
          }
        );

        ball.physicsImpostor.applyImpulse(
          cameraDirection.scale(20),
          ball.getAbsolutePosition()
        );

        ball.physicsImpostor.onCollideEvent = (collider, collidedWith) => {
          setTimeout(() => {
            ball.dispose();

            const collidePosition = collider.physicsBody.position;

            const decal = CreateDecal("decal", collidedWith.object as Mesh, {
              position: new Vector3(
                collidePosition.x,
                collidePosition.y,
                collidePosition.z
              ),
              normal: raycastHit?.getNormal(true),
              size: new Vector3(1, 1, 1),
            });

            decal.material =
              this._splatters[
                Math.floor(Math.random() * this._splatters.length)
              ];

            decal.isPickable = false;

            decal.setParent(collidedWith.object as Mesh);
          }, 0);
        };
      } else if (event.button === 2) {
        // right click (can't find enum)
        this._isZooming = !this._isZooming;
        this._camera.fov = this._isZooming ? 0.4 : 0.8;
      }
    };
  }

  private _listenEvents() {
    const canvas: HTMLCanvasElement = this._scene
      .getEngine()
      .getRenderingCanvas();

    this._onKeyDown(canvas);
    this._onKeyUp(canvas);
  }

  private _onKeyDown(canvas: HTMLCanvasElement) {
    canvas.addEventListener(
      "keydown",
      (event) => {
        switch (event.code) {
          case "KeyW":
            this._movingForward = true;
            break;
          case "KeyS":
            this._movingBack = true;
            break;
          case "KeyA":
            this._movingLeft = true;
            break;
          case "KeyD":
            this._movingRight = true;
            break;
          case "ShiftLeft":
            this._isRunning = true;
            break;
          case "Space":
            this._isJumping = true;
            break;
        }
      },
      false
    );
  }

  private _onKeyUp(canvas: HTMLCanvasElement) {
    canvas.addEventListener(
      "keyup",
      (event) => {
        switch (event.code) {
          case "KeyW":
            this._movingForward = false;
            break;
          case "KeyS":
            this._movingBack = false;
            break;
          case "KeyA":
            this._movingLeft = false;
            break;
          case "KeyD":
            this._movingRight = false;
            break;
          case "ShiftLeft":
            this._isRunning = false;
          case "Space":
            this._isJumping = false;
            break;
        }
      },
      false
    );
  }
}

export default PlayerController;
