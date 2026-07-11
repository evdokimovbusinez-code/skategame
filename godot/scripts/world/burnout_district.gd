class_name BurnoutDistrict
extends Node3D

const RailScript = preload("res://scripts/world/grind_rail.gd")
const NPCScript = preload("res://scripts/actors/skate_npc.gd")

var materials: Dictionary = {}


func _ready() -> void:
	_build_environment()
	_build_city_foundation()
	_build_skatepark()
	_build_burnout_shop()
	_build_apartments()
	_build_abandoned_building()
	_build_loading_and_parking()
	_build_street_life()
	_spawn_characters()


func _build_environment() -> void:
	var world_environment := WorldEnvironment.new()
	world_environment.name = "WorldEnvironment"
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#8e5b6b")
	environment.background_energy_multiplier = 0.78
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#9da4bf")
	environment.ambient_light_energy = 0.58
	environment.reflected_light_source = Environment.REFLECTION_SOURCE_BG
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.adjustment_enabled = true
	environment.adjustment_brightness = 1.08
	environment.adjustment_contrast = 1.08
	environment.adjustment_saturation = 1.02
	world_environment.environment = environment
	add_child(world_environment)

	var sun := DirectionalLight3D.new()
	sun.name = "Sun"
	sun.rotation_degrees = Vector3(-48, -132, 0)
	sun.light_color = Color("#ffb276")
	sun.light_energy = 2.15
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 90.0
	add_child(sun)

	var cool_fill := DirectionalLight3D.new()
	cool_fill.name = "CoolFill"
	cool_fill.rotation_degrees = Vector3(-35, 35, 0)
	cool_fill.light_color = Color("#7588bf")
	cool_fill.light_energy = 0.45
	add_child(cool_fill)


func _build_city_foundation() -> void:
	_add_box("Ground", Vector3(0, -0.25, 0), Vector3(112, 0.5, 112), Color("#343737"))
	_add_box("MainRoad", Vector3(0, 0.01, -6), Vector3(86, 0.06, 11), Color("#35383a"))
	_add_box("CrossRoad", Vector3(18, 0.015, 5), Vector3(10, 0.07, 70), Color("#35383a"))
	_add_box("ParkPad", Vector3(-2, 0.04, 9.5), Vector3(31, 0.08, 25), Color("#77746f"))
	_add_box("ShopSidewalk", Vector3(-18, 0.05, -10.6), Vector3(27, 0.1, 4.2), Color("#aaa39a"))
	_add_box("WestSidewalk", Vector3(-29.5, 0.05, 8), Vector3(5, 0.1, 31), Color("#aaa39a"))

	for x in range(-36, 40, 8):
		_add_box("RoadStripe", Vector3(x, 0.08, -6), Vector3(3.8, 0.018, 0.11), Color("#d0b467"), false)
	for z in range(-27, 32, 8):
		_add_box("RoadStripe", Vector3(18, 0.082, z), Vector3(0.11, 0.018, 3.8), Color("#d0b467"), false)
	for index in range(9):
		_add_box("Crosswalk", Vector3(11.8 - index * 0.72, 0.09, -5.4), Vector3(0.42, 0.02, 5.3), Color("#e7dfd1"), false)


func _build_skatepark() -> void:
	_add_box("NorthWall", Vector3(-2, 0.28, 21), Vector3(31, 0.55, 0.55), Color("#89857e"))
	_add_box("WestWall", Vector3(-17.25, 0.28, 9), Vector3(0.55, 0.55, 24.5), Color("#89857e"))
	_add_box("EastWall", Vector3(13.25, 0.28, 10.8), Vector3(0.55, 0.55, 20.8), Color("#89857e"))

	# Curved-looking transition built from small tangent-aligned collision slices.
	for index in range(11):
		var t := index / 10.0
		var z_position := 14.7 + t * 4.1
		var y_position := 0.08 + t * t * 1.75
		var angle := -atan(t * 1.45)
		var slice := _add_box(
			"QuarterPipeSlice",
			Vector3(-10.6, y_position, z_position),
			Vector3(8.0, 0.18, 0.55),
			Color("#8f8b84")
		)
		slice.rotation.x = angle
	_add_box("QuarterCoping", Vector3(-10.6, 2.02, 18.95), Vector3(8.1, 0.12, 0.16), Color("#737c82"))

	_add_slope("SouthBank", Vector3(-10.9, 0.72, 3.0), Vector3(6.3, 0.32, 4.2), -18.5, 0, Color("#8f8b84"))
	_add_slope("EastBank", Vector3(9.3, 0.66, 14.2), Vector3(6.0, 0.3, 3.8), -19.0, 90, Color("#8f8b84"))

	# Stair plaza.
	for index in range(5):
		var height := 0.14 * (index + 1)
		_add_box(
			"Stair",
			Vector3(0.8, height * 0.5, 4.5 + index * 0.55),
			Vector3(5.8, height, 0.58),
			Color("#85817a")
		)
	_add_box("LeftHubba", Vector3(-1.75, 0.48, 6.15), Vector3(0.65, 0.96, 3.9), Color("#85817a"))
	_add_box("RightHubba", Vector3(3.35, 0.48, 6.15), Vector3(0.65, 0.96, 3.9), Color("#85817a"))
	_add_rail(Vector3(-0.05, 0.82, 4.2), Vector3(-0.05, 0.22, 7.25))
	_add_rail(Vector3(1.65, 0.82, 4.2), Vector3(1.65, 0.22, 7.25))

	_add_box("ManualPad", Vector3(2.1, 0.29, 12.2), Vector3(5.8, 0.58, 3.6), Color("#85817a"))
	_add_slope("ManualPadWest", Vector3(-1.65, 0.27, 12.2), Vector3(2.2, 0.22, 1.9), -14, 90, Color("#85817a"))
	_add_slope("ManualPadEast", Vector3(5.85, 0.27, 12.2), Vector3(2.2, 0.22, 1.9), -14, -90, Color("#85817a"))
	_add_rail(Vector3(-7.0, 0.64, 9.4), Vector3(-1.2, 0.64, 9.4))
	_add_rail(Vector3(5.7, 0.6, 18.3), Vector3(11.4, 0.6, 18.3))

	_add_bench(Vector3(-5.8, 0, 19.6), 180)
	_add_bench(Vector3(9.0, 0, 20.0), 180)
	_add_cone(Vector3(11.5, 0, 8.8))
	_add_cone(Vector3(-14.6, 0, 2.0))


func _build_burnout_shop() -> void:
	var x := -18.0
	var z := -20.0
	var width := 23.0
	var depth := 15.0
	var height := 5.35
	var front_z := z + depth * 0.5
	var brick := Color("#743c37")
	var black := Color("#151619")

	_add_box("ShopBack", Vector3(x, height * 0.5, z - depth * 0.5), Vector3(width, height, 0.5), brick)
	_add_box("ShopLeft", Vector3(x - width * 0.5, height * 0.5, z), Vector3(0.5, height, depth), brick)
	_add_box("ShopRight", Vector3(x + width * 0.5, height * 0.5, z), Vector3(0.5, height, depth), brick)
	_add_box("ShopRoof", Vector3(x, height + 0.16, z), Vector3(width, 0.32, depth), Color("#8b8780"))
	_add_box("ShopFloor", Vector3(x, 0.055, z), Vector3(width - 0.7, 0.11, depth - 0.7), Color("#696662"))
	_add_box("FacadeLeft", Vector3(x - 9.3, 2.0, front_z), Vector3(4.0, 4.0, 0.48), brick)
	_add_box("FacadeRight", Vector3(x + 9.3, 2.0, front_z), Vector3(4.0, 4.0, 0.48), brick)
	_add_box("FacadeTop", Vector3(x, 4.5, front_z), Vector3(14.8, 1.7, 0.48), brick)
	_add_box("Awning", Vector3(x, 3.48, front_z + 0.45), Vector3(16.3, 0.18, 1.0), black)
	_add_box("NeonLine", Vector3(x, 3.35, front_z + 0.51), Vector3(16.1, 0.07, 0.92), Color("#ff5f48"), false, true)

	_add_world_label("BURNOUT", Vector3(x, 4.62, front_z + 0.32), 0, 108, Color("#ff6b4f"))
	_add_world_label("SKATE CO. / VHS / SNACKS", Vector3(x, 4.05, front_z + 0.33), 0, 28, Color("#e8ddc9"))
	_add_world_label("OPEN", Vector3(x - 6.4, 1.5, front_z + 0.34), 0, 42, Color("#ff7656"))

	# Deck wall and stocked aisles.
	for index in range(9):
		_add_box(
			"DisplayDeck",
			Vector3(x - 10.9, 2.35, z - 5.7 + index * 1.32),
			Vector3(0.12, 0.78, 0.28),
			[Color("#173c43"), Color("#9f3e33"), Color("#2b283f")][index % 3],
			false
		)
	for aisle_x in [x - 3.7, x + 0.2]:
		_add_box("Aisle", Vector3(aisle_x, 0.76, z - 1.3), Vector3(1.25, 1.45, 7.7), Color("#503723"))
		for shelf in range(4):
			_add_box("Shelf", Vector3(aisle_x, 0.38 + shelf * 0.38, z - 1.3), Vector3(1.38, 0.06, 7.82), black, false)
			for item in range(7):
				_add_box(
					"Product",
					Vector3(aisle_x + (-0.31 if shelf % 2 == 0 else 0.31), 0.53 + shelf * 0.38, z - 4.15 + item * 0.95),
					Vector3(0.4, 0.23, 0.27),
					[Color("#c84f42"), Color("#d0a548"), Color("#4f735f"), Color("#405c78")][(item + shelf) % 4],
					false
				)

	_add_box("Cooler", Vector3(x + 8.8, 1.4, z - 2), Vector3(1.3, 2.75, 8.6), Color("#252b30"))
	_add_world_label("COLD", Vector3(x + 8.1, 2.9, z - 1.5), 90, 45, Color("#70d8dd"))
	_add_box("Counter", Vector3(x + 4.35, 0.5, z + 4.65), Vector3(4.2, 1.0, 1.05), Color("#6d4c30"))
	_add_box("Register", Vector3(x + 5.5, 1.16, z + 4.58), Vector3(0.78, 0.34, 0.58), Color("#25272a"), false)

	for light_x in [x - 6.2, x, x + 6.2]:
		var light := OmniLight3D.new()
		light.position = Vector3(light_x, 4.25, z + 0.2)
		light.light_color = Color("#ffc58a")
		light.light_energy = 4.2
		light.omni_range = 11.0
		light.add_to_group("night_lights")
		add_child(light)


func _build_apartments() -> void:
	var z := 29.2
	var brick := Color("#78443f")
	_add_box("ApartmentMain", Vector3(-3, 4.5, z), Vector3(31.5, 9, 1), brick)
	_add_box("ApartmentLeft", Vector3(-19, 4, 25.5), Vector3(1, 8, 8.4), brick)
	_add_box("ApartmentRight", Vector3(13, 4, 25.5), Vector3(1, 8, 8.4), brick)
	for row in range(3):
		for column in range(8):
			var window_x := -14.7 + column * 3.35
			var lit := (column * 5 + row * 3) % 7 < 3
			_add_box(
				"Window",
				Vector3(window_x, 2.25 + row * 2.15, z - 0.54),
				Vector3(1.15, 1.05, 0.08),
				Color("#ffcb7f") if lit else Color("#172029"),
				false,
				lit
			)
	for balcony_x in [-12.8, -3.0, 6.8]:
		for y in [3.2, 5.35]:
			_add_box("Balcony", Vector3(balcony_x, y, z - 1.0), Vector3(3.2, 0.12, 1.05), Color("#293036"))
	_add_world_label("RIDGEWAY APARTMENTS", Vector3(-3, 1.65, z - 0.75), 180, 46, Color("#f0b05e"))


func _build_abandoned_building() -> void:
	var x := 30.0
	var z := 12.0
	var brick := Color("#663b38")
	_add_box("AbandonedEast", Vector3(x + 6.3, 3.4, z), Vector3(0.65, 6.8, 16.5), brick)
	_add_box("AbandonedNorth", Vector3(x, 3.4, z + 8), Vector3(13, 6.8, 0.65), brick)
	_add_box("AbandonedSouth", Vector3(x, 3.4, z - 8), Vector3(13, 6.8, 0.65), brick)
	_add_box("BrokenWallA", Vector3(x - 6.1, 1.55, z - 5.9), Vector3(0.65, 3.1, 4.1), brick)
	_add_box("BrokenWallB", Vector3(x - 6.1, 4.6, z + 1.3), Vector3(0.65, 2.2, 4.8), brick)
	_add_box("BrokenWallC", Vector3(x - 6.1, 2.9, z + 6.9), Vector3(0.65, 5.8, 2.2), brick)
	_add_box("AbandonedFloor", Vector3(x, 0.055, z), Vector3(12.1, 0.11, 15.4), Color("#5e5a55"))
	_add_box("Mezzanine", Vector3(x + 3.8, 3.45, z + 2.4), Vector3(4.3, 0.24, 9.2), Color("#77736e"))
	for index in range(9):
		var height := 0.34 * (index + 1)
		_add_box("InteriorStair", Vector3(x - 3.4 + index * 0.48, height * 0.5, z + 5.5), Vector3(0.52, height, 2), Color("#77736e"))
	_add_world_label("ZERO", Vector3(x - 6.45, 2.25, z - 1.0), -90, 84, Color("#e8e1d5"))
	_add_world_label("BURN BRIDGES", Vector3(x - 6.46, 4.3, z + 5.8), -90, 42, Color("#d84c82"))


func _build_loading_and_parking() -> void:
	_add_box("LoadingWall", Vector3(-36.2, 3.5, 5.5), Vector3(0.8, 7, 22), Color("#73736f"))
	_add_box("LoadingDock", Vector3(-32.6, 1.05, 0), Vector3(6.5, 2.1, 6.2), Color("#85817a"))
	_add_world_label("LOADING", Vector3(-35.72, 4.4, 2), 90, 58, Color("#e2b75a"))
	_add_box("TruckCargo", Vector3(-31.0, 1.35, -3.0), Vector3(2.3, 2.5, 5), Color("#d7d2c7"))
	_add_box("TruckCab", Vector3(-31.0, 0.95, 1.0), Vector3(2.15, 1.8, 2.0), Color("#a63e35"))
	_add_box("VacantLot", Vector3(-27.2, 0.04, 22.5), Vector3(15, 0.08, 13), Color("#51483b"))

	_add_box("Parking", Vector3(29, 0.04, -15), Vector3(16, 0.08, 16), Color("#343739"))
	_add_car(Vector3(26.8, 0, -16.8), Color("#86403c"))
	_add_car(Vector3(32.0, 0, -12.6), Color("#314d6e"))
	_add_cone(Vector3(24.1, 0, -9.5))
	_add_cone(Vector3(25.0, 0, -9.9))


func _build_street_life() -> void:
	for lamp_position in [
		Vector3(-28, 0, -10.8),
		Vector3(-5, 0, -10.8),
		Vector3(11, 0, -10.8),
		Vector3(24, 0, -1),
		Vector3(24, 0, 21.5),
		Vector3(-20.5, 0, 21.4)
	]:
		_add_lamp(lamp_position)
	for pole_x in [-38.0, -12.0, 12.0, 38.0]:
		_add_box("PowerPole", Vector3(pole_x, 3.2, -3), Vector3(0.22, 6.4, 0.22), Color("#4b3326"))
		_add_box("PowerCrossbar", Vector3(pole_x, 5.85, -3), Vector3(2.7, 0.14, 0.14), Color("#4b3326"), false)

	# Physical perimeter.
	_add_box("NorthFence", Vector3(0, 1.2, -40), Vector3(80, 2.4, 0.18), Color("#343a3d"))
	_add_box("SouthFence", Vector3(0, 1.2, 40), Vector3(80, 2.4, 0.18), Color("#343a3d"))
	_add_box("WestFence", Vector3(-40, 1.2, 0), Vector3(0.18, 2.4, 80), Color("#343a3d"))
	_add_box("EastFence", Vector3(40, 1.2, 0), Vector3(0.18, 2.4, 80), Color("#343a3d"))


func _spawn_characters() -> void:
	_add_npc("TYLER", "DIY park is yours. Show me a clean line.", Vector3(-1.5, 0.1, 10), Color("#22252b"), Color("#153d46"))
	_add_npc("MIA", "Burnout has new decks inside.", Vector3(-23.8, 0.1, -10.5), Color("#17151b"), Color("#a32f6e"))
	_add_npc("DANTE", "The abandoned building has a roof route.", Vector3(8.2, 0.1, 17.2), Color("#3f4a56"), Color("#55544e"))


func _add_npc(npc_name: String, line: String, at: Vector3, shirt: Color, accent: Color) -> void:
	var npc := NPCScript.new()
	npc.position = at
	npc.setup(npc_name, line, shirt, accent)
	add_child(npc)


func _add_rail(start: Vector3, finish: Vector3) -> void:
	var rail := RailScript.new()
	add_child(rail)
	rail.setup(start, finish)


func _add_box(
	node_name: String,
	at: Vector3,
	size: Vector3,
	color: Color,
	collision := true,
	emissive := false
) -> Node3D:
	var root := Node3D.new()
	root.name = node_name
	root.position = at
	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = _material(color, 0.84, 0.02, emissive)
	mesh_instance.mesh = mesh
	mesh_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	root.add_child(mesh_instance)
	if collision:
		var body := StaticBody3D.new()
		var shape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = size
		shape.shape = box
		body.add_child(shape)
		root.add_child(body)
	add_child(root)
	return root


func _add_slope(node_name: String, at: Vector3, size: Vector3, tilt_degrees: float, yaw_degrees: float, color: Color) -> Node3D:
	var slope := _add_box(node_name, at, size, color)
	slope.rotation_degrees = Vector3(tilt_degrees, yaw_degrees, 0)
	return slope


func _add_bench(at: Vector3, yaw_degrees: float) -> void:
	var root := Node3D.new()
	root.position = at
	root.rotation_degrees.y = yaw_degrees
	add_child(root)
	for index in range(4):
		var slat := _create_visual_box(Vector3(1.8, 0.07, 0.1), Vector3(0, 0.46, -0.2 + index * 0.13), Color("#765638"))
		root.add_child(slat)
	for side in [-0.78, 0.78]:
		root.add_child(_create_visual_box(Vector3(0.09, 0.48, 0.5), Vector3(side, 0.24, 0), Color("#646d72")))


func _add_cone(at: Vector3) -> void:
	var cone := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.04
	mesh.bottom_radius = 0.2
	mesh.height = 0.55
	mesh.radial_segments = 12
	mesh.material = _material(Color("#e6612a"), 0.75, 0.0)
	cone.mesh = mesh
	cone.position = at + Vector3.UP * 0.275
	add_child(cone)


func _add_car(at: Vector3, color: Color) -> void:
	_add_box("CarBody", at + Vector3.UP * 0.3, Vector3(1.75, 0.42, 3.6), color)
	_add_box("CarCabin", at + Vector3(0, 0.65, -0.2), Vector3(1.35, 0.38, 1.8), Color("#25303a"), false)


func _add_lamp(at: Vector3) -> void:
	_add_box("LampPost", at + Vector3(0, 2.1, 0), Vector3(0.12, 4.2, 0.12), Color("#4d565c"))
	_add_box("LampArm", at + Vector3(0.42, 4.18, 0), Vector3(0.9, 0.09, 0.12), Color("#4d565c"), false)
	var light := OmniLight3D.new()
	light.position = at + Vector3(0.84, 4.02, 0)
	light.light_color = Color("#ffd08a")
	light.light_energy = 2.8
	light.omni_range = 8.5
	light.add_to_group("night_lights")
	add_child(light)


func _add_world_label(text: String, at: Vector3, yaw_degrees: float, font_size: int, color: Color) -> void:
	var label := Label3D.new()
	label.text = text
	label.position = at
	label.rotation_degrees.y = yaw_degrees
	label.font_size = font_size
	label.modulate = color
	label.outline_modulate = Color("#111111")
	label.outline_size = maxi(2, int(font_size / 12.0))
	label.billboard = BaseMaterial3D.BILLBOARD_DISABLED
	add_child(label)


func _create_visual_box(size: Vector3, at: Vector3, color: Color) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = _material(color, 0.84, 0.02)
	instance.mesh = mesh
	instance.position = at
	return instance


func _material(color: Color, roughness: float, metallic: float, emissive := false) -> StandardMaterial3D:
	var key := "%s|%.2f|%.2f|%s" % [color.to_html(), roughness, metallic, emissive]
	if materials.has(key):
		return materials[key]
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	material.metallic = metallic
	if emissive:
		material.emission_enabled = true
		material.emission = color
		material.emission_energy_multiplier = 2.5
	materials[key] = material
	return material
