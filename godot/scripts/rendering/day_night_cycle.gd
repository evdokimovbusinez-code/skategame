class_name DayNightCycle
extends Node

const Config = preload("res://scripts/config/game_config.gd")

var time01 := Config.DAY_START
var sun: DirectionalLight3D
var environment: Environment
var night_lights: Array[OmniLight3D] = []

const KEYS := [
	{"t": 0.0, "sun": Vector3(4, 5, 14), "sun_color": Color("#ffc3a5"), "sun_energy": 1.4, "ambient": Color("#8ea2c2"), "ambient_energy": 0.96, "fog": Color("#a78377"), "night": 0.3},
	{"t": 0.25, "sun": Vector3(10, 18, 6), "sun_color": Color("#ffe0b2"), "sun_energy": 2.12, "ambient": Color("#91abc8"), "ambient_energy": 1.16, "fog": Color("#b09b88"), "night": 0.0},
	{"t": 0.5, "sun": Vector3(-14, 18, 16), "sun_color": Color("#ffb276"), "sun_energy": 2.38, "ambient": Color("#8b8ca6"), "ambient_energy": 1.34, "fog": Color("#ae7d72"), "night": 0.34},
	{"t": 0.75, "sun": Vector3(-8, 9, -12), "sun_color": Color("#3e527e"), "sun_energy": 0.36, "ambient": Color("#172238"), "ambient_energy": 0.34, "fog": Color("#171c27"), "night": 1.0},
	{"t": 1.0, "sun": Vector3(4, 5, 14), "sun_color": Color("#ffc3a5"), "sun_energy": 1.4, "ambient": Color("#8ea2c2"), "ambient_energy": 0.96, "fog": Color("#a78377"), "night": 0.3},
]


func _ready() -> void:
	sun = get_tree().current_scene.find_child("Sun", true, false) as DirectionalLight3D
	var world := get_tree().current_scene.find_child("WorldEnvironment", true, false) as WorldEnvironment
	if world:
		environment = world.environment
	for node in get_tree().get_nodes_in_group("night_lights"):
		if node is OmniLight3D:
			night_lights.append(node)
	_apply_time()


func _process(delta: float) -> void:
	time01 = fmod(time01 + delta / Config.DAY_CYCLE_SECONDS, 1.0)
	_apply_time()


func _apply_time() -> void:
	var a: Dictionary = KEYS[0]
	var b: Dictionary = KEYS[1]
	for index in range(KEYS.size() - 1):
		if time01 >= float(KEYS[index].t) and time01 <= float(KEYS[index + 1].t):
			a = KEYS[index]
			b = KEYS[index + 1]
			break
	var span := maxf(float(b.t) - float(a.t), 0.001)
	var blend := smoothstep(0.0, 1.0, (time01 - float(a.t)) / span)
	var night := lerpf(float(a.night), float(b.night), blend)
	if sun:
		var sun_a: Vector3 = a.sun
		var sun_b: Vector3 = b.sun
		var direction: Vector3 = sun_a.lerp(sun_b, blend).normalized()
		sun.rotation = Vector3(-asin(direction.y), atan2(direction.x, direction.z), 0.0)
		var sun_color_a: Color = a.sun_color
		var sun_color_b: Color = b.sun_color
		sun.light_color = sun_color_a.lerp(sun_color_b, blend)
		sun.light_energy = lerpf(float(a.sun_energy), float(b.sun_energy), blend)
	if environment:
		var fog_a: Color = a.fog
		var fog_b: Color = b.fog
		var ambient_a: Color = a.ambient
		var ambient_b: Color = b.ambient
		environment.background_color = fog_a.lerp(fog_b, blend)
		environment.ambient_light_color = ambient_a.lerp(ambient_b, blend)
		environment.ambient_light_energy = lerpf(float(a.ambient_energy), float(b.ambient_energy), blend) * 0.55
	for light in night_lights:
		light.light_energy = lerpf(0.35, 3.8, night)
