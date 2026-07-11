class_name SkaterController
extends CharacterBody3D

signal speed_changed(value: float)
signal mode_changed(value: String)
signal trick_called(name: String, score: int)
signal prompt_changed(text: String)

const GRAVITY := 21.58
const SKATE_MAX_SPEED := 12.5
const PUSH_ACCELERATION := 15.0
const ROLL_ACCELERATION := 3.4
const BRAKE_DECELERATION := 14.0
const ROLL_DRAG := 0.42
const WALK_SPEED := 4.2
const RUN_SPEED := 6.8
const OLLIE_VELOCITY := 7.2
const GRIND_MIN_SPEED := 3.0

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

var visual_root := Node3D.new()
var body_root := Node3D.new()
var board_root := Node3D.new()
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
		global_position = Vector3(4.0, 1.2, 10.5)
		velocity = Vector3.ZERO
		skate_speed = 0.0
		_end_grind()

	if Input.is_action_just_pressed("toggle_mode") and absf(skate_speed) < 2.0:
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
	var turn_rate := lerpf(2.35, 1.18, speed_fraction)
	yaw -= steering * turn_rate * delta

	if grounded:
		if Input.is_action_just_pressed("move_forward"):
			skate_speed = minf(SKATE_MAX_SPEED, skate_speed + 4.8)
		elif Input.is_action_pressed("move_forward"):
			skate_speed = move_toward(skate_speed, SKATE_MAX_SPEED, ROLL_ACCELERATION * delta)
		else:
			skate_speed = move_toward(skate_speed, 0.0, ROLL_DRAG * delta)
		if Input.is_action_pressed("move_back"):
			skate_speed = move_toward(skate_speed, 0.0, BRAKE_DECELERATION * delta)
		if Input.is_action_just_pressed("ollie"):
			velocity.y = OLLIE_VELOCITY
			_start_trick("OLLIE", 45, 0.42)
	else:
		velocity.y -= GRAVITY * delta
		air_time += delta
		if Input.is_action_just_pressed("trick"):
			_start_trick("KICKFLIP", 150, 0.56)

	var forward := -transform.basis.z
	velocity.x = forward.x * skate_speed
	velocity.z = forward.z * skate_speed
	move_and_slide()

	if is_on_floor() and not grounded:
		if air_time > 0.18:
			trick_called.emit("CLEAN LANDING", 25)
			combo_score += 25
		air_time = 0.0


func _update_walking(delta: float) -> void:
	rotation.y = yaw
	var input := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var local_direction := Vector3(input.x, 0.0, input.y)
	var direction := (transform.basis * local_direction).normalized()
	var target_speed := RUN_SPEED if Input.is_action_pressed("sprint") else WALK_SPEED

	if direction.length_squared() > 0.01:
		velocity.x = move_toward(velocity.x, direction.x * target_speed, delta * 18.0)
		velocity.z = move_toward(velocity.z, direction.z * target_speed, delta * 18.0)
	else:
		velocity.x = move_toward(velocity.x, 0.0, delta * 20.0)
		velocity.z = move_toward(velocity.z, 0.0, delta * 20.0)

	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	elif Input.is_action_just_pressed("ollie"):
		velocity.y = 8.0

	move_and_slide()
	skate_speed = Vector2(velocity.x, velocity.z).length()


func _try_begin_grind() -> void:
	if is_on_floor() or absf(skate_speed) < GRIND_MIN_SPEED:
		return
	var nearest: GrindRail
	var best_distance := 0.78
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
		velocity = rail_direction * maxf(skate_speed, 5.5) + Vector3.UP * 6.4
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
	body_root.position.y = sin(Time.get_ticks_msec() * 0.0022) * 0.012
	camera_pivot.rotation.x = camera_pitch

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


func _build_collision() -> void:
	var collision := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.32
	capsule.height = 1.34
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
	visual_root.name = "Visual"
	add_child(visual_root)
	body_root.name = "Body"
	visual_root.add_child(body_root)
	_add_box(body_root, Vector3(0.48, 0.53, 0.28), Vector3(0, 1.12, 0), Color("#171519"))
	_add_box(body_root, Vector3(0.38, 0.34, 0.32), Vector3(0, 1.57, 0), Color("#d19a69"))
	_add_box(body_root, Vector3(0.52, 0.42, 0.05), Vector3(0, 1.1, -0.17), Color("#111112"))
	_add_box(body_root, Vector3(0.38, 0.23, 0.04), Vector3(0, 1.1, -0.205), Color("#d8d0c5"))
	for side in [-1.0, 1.0]:
		_add_box(body_root, Vector3(0.15, 0.58, 0.17), Vector3(side * 0.31, 1.03, 0), Color("#d19a69"))
		_add_box(body_root, Vector3(0.18, 0.7, 0.22), Vector3(side * 0.14, 0.48, 0), Color("#17191f"))
		_add_box(body_root, Vector3(0.25, 0.12, 0.43), Vector3(side * 0.14, 0.09, -0.08), Color("#eee5d6"))
		_add_box(body_root, Vector3(0.07, 0.05, 0.03), Vector3(side * 0.07, 1.6, -0.175), Color("#151515"))
	for index in range(7):
		var spike := MeshInstance3D.new()
		var cone := CylinderMesh.new()
		cone.top_radius = 0.0
		cone.bottom_radius = 0.065
		cone.height = 0.24 + sin(index / 6.0 * PI) * 0.12
		cone.radial_segments = 5
		cone.material = _material(Color("#a42c7a"), 0.8, 0.0)
		spike.mesh = cone
		spike.position = Vector3(0, 1.83 + cone.height * 0.5, -0.18 + index * 0.06)
		spike.rotation.z = (index - 3) * 0.06
		body_root.add_child(spike)
	_build_board()


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
