class_name SkaterController
extends CharacterBody3D

const Config = preload("res://scripts/config/game_config.gd")
const PunkRigScript = preload("res://scripts/player/punk_rig.gd")

signal speed_changed(value: float)
signal mode_changed(value: String)
signal trick_called(name: String, score: int)
signal prompt_changed(text: String)

const GRAVITY := Config.GRAVITY
const SKATE_MAX_SPEED := Config.SKATE_MAX_SPEED
const PUSH_ACCELERATION := Config.SKATE_PUSH_ACCELERATION
const ROLL_ACCELERATION := Config.SKATE_ROLL_ACCELERATION
const BRAKE_DECELERATION := Config.SKATE_BRAKE_DECELERATION
const ROLL_DRAG := Config.SKATE_GROUND_FRICTION
const WALK_SPEED := Config.WALK_MAX_SPEED
const RUN_SPEED := Config.WALK_MAX_SPEED * Config.WALK_SPRINT_MULTIPLIER
const OLLIE_VELOCITY := Config.OLLIE_IMPULSE
const GRIND_MIN_SPEED := Config.GRIND_MIN_ENTRY_SPEED

var skate_mode := true
var skate_speed := 0.0
var yaw := 3.72
var camera_pitch := -0.16
var steering := 0.0
var grind_rail: GrindRail
var grind_t := 0.0
var grind_direction := 1.0
var trick_time := 0.0
var trick_duration := 0.0
var trick_kind := ""
var air_time := 0.0
var combo_score := 0

var visual_root: Node3D
var body_root: Node3D
var board_root: Node3D
var punk_rig: PunkRig
var camera_pivot := Node3D.new()
var camera := Camera3D.new()
var mode_transition := 1.0


func _ready() -> void:
	floor_max_angle = deg_to_rad(52.0)
	floor_snap_length = 0.24
	safe_margin = 0.04
	_build_collision()
	_build_character()
	_build_camera()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	mode_changed.emit("SKATE")


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		yaw -= event.relative.x * 0.0026
		camera_pitch = clampf(camera_pitch - event.relative.y * 0.0021, -0.58, 0.34)


func _physics_process(delta: float) -> void:
	if Input.is_action_just_pressed("reset_player"):
		global_position = Config.PLAYER_SPAWN
		velocity = Vector3.ZERO
		skate_speed = 0.0
		_end_grind()

	if Input.is_action_just_pressed("toggle_mode") and absf(skate_speed) < Config.MODE_TOGGLE_MAX_SPEED:
		skate_mode = not skate_mode
		mode_transition = 0.0
		mode_changed.emit("SKATE" if skate_mode else "WALK")

	if grind_rail:
		_update_grind(delta)
	else:
		if skate_mode:
			_update_skating(delta)
		else:
			_update_walking(delta)
		_try_begin_grind()

	_update_interaction()
	_update_visuals(delta)
	speed_changed.emit(clampf(absf(skate_speed) / SKATE_MAX_SPEED, 0.0, 1.0))


func _update_skating(delta: float) -> void:
	rotation.y = yaw
	var grounded := is_on_floor()
	var steer_input := Input.get_axis("move_left", "move_right")
	steering = move_toward(steering, steer_input, delta * 6.0)

	var speed_fraction := clampf(absf(skate_speed) / SKATE_MAX_SPEED, 0.0, 1.0)
	var turn_rate := deg_to_rad(lerpf(Config.SKATE_LOW_SPEED_TURN_RATE, Config.SKATE_MAX_SPEED_TURN_RATE, speed_fraction))
	yaw -= steering * turn_rate * delta

	if grounded:
		if Input.is_action_just_pressed("move_forward"):
			skate_speed = minf(SKATE_MAX_SPEED, skate_speed + PUSH_ACCELERATION * Config.SKATE_PUSH_BURST_FRACTION)
		elif Input.is_action_pressed("move_forward"):
			skate_speed = move_toward(skate_speed, SKATE_MAX_SPEED, ROLL_ACCELERATION * delta)
		else:
			skate_speed = move_toward(skate_speed, 0.0, ROLL_DRAG * delta)
		if Input.is_action_pressed("move_back"):
			skate_speed = move_toward(skate_speed, 0.0, BRAKE_DECELERATION * delta)
		if Input.is_action_just_pressed("ollie"):
			velocity.y = OLLIE_VELOCITY
			_start_trick("OLLIE", Config.SCORE.ollie, 0.42)
	else:
		velocity.y -= GRAVITY * delta
		air_time += delta
		if Input.is_action_just_pressed("trick"):
			_start_trick("KICKFLIP", Config.SCORE.kickflip, Config.KICKFLIP_DURATION)

	var forward := -transform.basis.z
	velocity.x = forward.x * skate_speed
	velocity.z = forward.z * skate_speed
	move_and_slide()

	if is_on_floor() and not grounded:
		if air_time > 0.18:
			trick_called.emit("CLEAN LANDING", Config.SCORE.clean_landing)
			combo_score += Config.SCORE.clean_landing
		air_time = 0.0


func _update_walking(delta: float) -> void:
	rotation.y = yaw
	var input := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var local_direction := Vector3(input.x, 0.0, input.y)
	var direction := (transform.basis * local_direction).normalized()
	var target_speed := RUN_SPEED if Input.is_action_pressed("sprint") else WALK_SPEED

	if direction.length_squared() > 0.01:
		velocity.x = move_toward(velocity.x, direction.x * target_speed, delta * Config.WALK_ACCELERATION)
		velocity.z = move_toward(velocity.z, direction.z * target_speed, delta * Config.WALK_ACCELERATION)
	else:
		velocity.x = move_toward(velocity.x, 0.0, delta * Config.WALK_DECELERATION)
		velocity.z = move_toward(velocity.z, 0.0, delta * Config.WALK_DECELERATION)

	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	elif Input.is_action_just_pressed("ollie"):
		velocity.y = Config.WALK_JUMP_IMPULSE

	move_and_slide()
	skate_speed = Vector2(velocity.x, velocity.z).length()


func _try_begin_grind() -> void:
	if is_on_floor() or absf(skate_speed) < GRIND_MIN_SPEED:
		return
	var nearest: GrindRail
	var best_distance := Config.GRIND_SNAP_DISTANCE
	for candidate in get_tree().get_nodes_in_group("grind_rails"):
		if candidate is GrindRail:
			var distance := candidate.distance_to_rail(global_position)
			if distance < best_distance:
				best_distance = distance
				nearest = candidate
	if not nearest:
		return
	grind_rail = nearest
	grind_t = grind_rail.closest_t(global_position)
	var rail_direction := (grind_rail.end_point - grind_rail.start_point).normalized()
	var travel_direction := -transform.basis.z
	grind_direction = 1.0 if travel_direction.dot(rail_direction) >= 0.0 else -1.0
	velocity = Vector3.ZERO
	mode_changed.emit("GRIND")
	trick_called.emit("50-50 GRIND", 100)


func _update_grind(delta: float) -> void:
	if not grind_rail:
		return
	var rail_length := grind_rail.start_point.distance_to(grind_rail.end_point)
	grind_t += grind_direction * maxf(absf(skate_speed), 4.0) * delta / maxf(rail_length, 0.1)
	var rail_direction := (grind_rail.end_point - grind_rail.start_point).normalized() * grind_direction
	yaw = atan2(-rail_direction.x, -rail_direction.z)
	rotation.y = yaw
	global_position = grind_rail.point_at(grind_t) + Vector3.UP * 0.48

	if Input.is_action_just_pressed("ollie"):
		_end_grind()
		velocity = rail_direction * (maxf(skate_speed, 5.5) + Config.GRIND_EXIT_BOOST) + Vector3.UP * 6.4
	elif grind_t <= 0.0 or grind_t >= 1.0:
		_end_grind()
		velocity = rail_direction * maxf(skate_speed, 4.5)


func _end_grind() -> void:
	grind_rail = null
	grind_t = 0.0
	if is_inside_tree():
		mode_changed.emit("SKATE" if skate_mode else "WALK")


func _start_trick(label: String, score: int, duration: float) -> void:
	trick_kind = label
	trick_time = 0.0
	trick_duration = duration
	combo_score += score
	trick_called.emit(label, score)


func _update_interaction() -> void:
	var nearest: Node3D
	var best_distance := 2.5
	for candidate in get_tree().get_nodes_in_group("interactables"):
		if candidate is Node3D:
			var distance := global_position.distance_to(candidate.global_position)
			if distance < best_distance:
				best_distance = distance
				nearest = candidate
	if nearest:
		prompt_changed.emit("[E] TALK TO " + str(nearest.get("display_name")).to_upper())
		if Input.is_action_just_pressed("interact") and nearest.has_method("interact"):
			prompt_changed.emit(nearest.interact())
	else:
		prompt_changed.emit("")


func _update_visuals(delta: float) -> void:
	mode_transition = minf(1.0, mode_transition + delta * 5.5)
	var speed_fraction := clampf(absf(skate_speed) / SKATE_MAX_SPEED, 0.0, 1.0)
	var lean := -steering * speed_fraction * 0.28
	body_root.rotation.z = lerpf(body_root.rotation.z, lean, delta * 8.0)
	var animation_time := Time.get_ticks_msec() * 0.001
	body_root.position.y = PunkRigScript.HIP_HEIGHT + sin(animation_time * 2.2) * 0.012
	camera_pivot.rotation.x = camera_pitch
	_update_bone_animation(animation_time, speed_fraction, delta)

	if trick_time < trick_duration:
		trick_time += delta
		var progress := clampf(trick_time / maxf(trick_duration, 0.01), 0.0, 1.0)
		if trick_kind == "KICKFLIP":
			board_root.rotation.z = progress * TAU
		else:
			board_root.rotation.x = sin(progress * PI) * -0.25
	else:
		board_root.rotation.x = lerpf(board_root.rotation.x, 0.0, delta * 12.0)
		board_root.rotation.z = lerpf(board_root.rotation.z, 0.0, delta * 12.0)

	if skate_mode:
		board_root.position = board_root.position.lerp(Vector3(0, 0.12, 0), mode_transition)
		board_root.rotation.y = lerpf(board_root.rotation.y, 0.0, mode_transition)
	else:
		board_root.position = board_root.position.lerp(Vector3(0, 1.05, 0.31), mode_transition)
		board_root.rotation.y = lerpf(board_root.rotation.y, PI * 0.5, mode_transition)


func _update_bone_animation(time: float, speed_fraction: float, delta: float) -> void:
	if not punk_rig:
		return
	var blend := clampf(delta * 10.0, 0.0, 1.0)
	if skate_mode:
		var push_phase := sin(time * (4.0 + speed_fraction * 5.0))
		punk_rig.spine.rotation.x = lerpf(punk_rig.spine.rotation.x, -0.12 - speed_fraction * 0.08, blend)
		punk_rig.left_upper_leg.rotation.x = lerpf(punk_rig.left_upper_leg.rotation.x, 0.2, blend)
		punk_rig.right_upper_leg.rotation.x = lerpf(punk_rig.right_upper_leg.rotation.x, -0.14 + push_phase * 0.11, blend)
		punk_rig.left_lower_leg.rotation.x = lerpf(punk_rig.left_lower_leg.rotation.x, -0.28, blend)
		punk_rig.right_lower_leg.rotation.x = lerpf(punk_rig.right_lower_leg.rotation.x, 0.18 + maxf(push_phase, 0.0) * 0.35, blend)
		punk_rig.left_upper_arm.rotation.x = lerpf(punk_rig.left_upper_arm.rotation.x, -0.12 + push_phase * 0.12, blend)
		punk_rig.right_upper_arm.rotation.x = lerpf(punk_rig.right_upper_arm.rotation.x, 0.12 - push_phase * 0.12, blend)
	else:
		var stride := sin(time * (5.4 if speed_fraction < 0.8 else 8.0)) * minf(speed_fraction * 1.5, 1.0)
		punk_rig.spine.rotation.x = lerpf(punk_rig.spine.rotation.x, -0.03, blend)
		punk_rig.left_upper_leg.rotation.x = lerpf(punk_rig.left_upper_leg.rotation.x, stride * 0.65, blend)
		punk_rig.right_upper_leg.rotation.x = lerpf(punk_rig.right_upper_leg.rotation.x, -stride * 0.65, blend)
		punk_rig.left_lower_leg.rotation.x = lerpf(punk_rig.left_lower_leg.rotation.x, maxf(-stride, 0.0) * 0.62, blend)
		punk_rig.right_lower_leg.rotation.x = lerpf(punk_rig.right_lower_leg.rotation.x, maxf(stride, 0.0) * 0.62, blend)
		punk_rig.left_upper_arm.rotation.x = lerpf(punk_rig.left_upper_arm.rotation.x, -stride * 0.52, blend)
		punk_rig.right_upper_arm.rotation.x = lerpf(punk_rig.right_upper_arm.rotation.x, stride * 0.52, blend)


func _build_collision() -> void:
	var collision := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = Config.CAPSULE_RADIUS
	capsule.height = Config.CAPSULE_HALF_HEIGHT * 2.0 + Config.CAPSULE_RADIUS * 2.0
	collision.shape = capsule
	collision.position.y = 0.67
	add_child(collision)


func _build_camera() -> void:
	camera_pivot.name = "CameraPivot"
	camera_pivot.position = Vector3(0, 1.05, 0)
	add_child(camera_pivot)
	camera.name = "PlayerCamera"
	camera.position = Vector3(0, 1.65, 5.5)
	camera.fov = 62.0
	camera.current = true
	camera_pivot.add_child(camera)


func _build_character() -> void:
	punk_rig = PunkRigScript.new()
	punk_rig.name = "Visual"
	punk_rig.build()
	add_child(punk_rig)
	visual_root = punk_rig
	body_root = punk_rig.hips
	board_root = punk_rig.board


func _build_board() -> void:
	board_root.name = "Skateboard"
	visual_root.add_child(board_root)
	_add_box(board_root, Vector3(0.34, 0.055, 1.08), Vector3.ZERO, Color("#123b43"))
	_add_box(board_root, Vector3(0.27, 0.012, 0.76), Vector3(0, 0.035, 0), Color("#111111"))
	for z_position in [-0.34, 0.34]:
		_add_box(board_root, Vector3(0.31, 0.05, 0.09), Vector3(0, -0.06, z_position), Color("#bab7b0"))
		for x_position in [-0.19, 0.19]:
			var wheel := MeshInstance3D.new()
			var cylinder := CylinderMesh.new()
			cylinder.top_radius = 0.06
			cylinder.bottom_radius = 0.06
			cylinder.height = 0.075
			cylinder.radial_segments = 12
			cylinder.material = _material(Color("#eee4d4"), 0.7, 0.0)
			wheel.mesh = cylinder
			wheel.rotation.z = PI * 0.5
			wheel.position = Vector3(x_position, -0.09, z_position)
			board_root.add_child(wheel)


func _add_box(parent: Node3D, size: Vector3, at: Vector3, color: Color) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = _material(color, 0.82, 0.02)
	instance.mesh = mesh
	instance.position = at
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	parent.add_child(instance)
	return instance


func _material(color: Color, roughness: float, metallic: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	material.metallic = metallic
	return material
