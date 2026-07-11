extends Node3D

const DistrictScript = preload("res://scripts/world/burnout_district.gd")
const PlayerScript = preload("res://scripts/player/skater_controller.gd")
const HUDScript = preload("res://scripts/ui/skate_hud.gd")
const Config = preload("res://scripts/config/game_config.gd")
const DayNightScript = preload("res://scripts/rendering/day_night_cycle.gd")
const GameStateScript = preload("res://scripts/systems/game_state.gd")

var player: CharacterBody3D
var hud: CanvasLayer
var game_state: GameState


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_register_input_map()

	var district := DistrictScript.new()
	district.name = "BurnoutDistrict"
	add_child(district)
	var day_night := DayNightScript.new()
	day_night.name = "DayNightCycle"
	add_child(day_night)

	player = PlayerScript.new()
	player.name = "Player"
	player.position = Config.PLAYER_SPAWN
	add_child(player)

	hud = HUDScript.new()
	hud.name = "HUD"
	add_child(hud)
	game_state = GameStateScript.new()
	game_state.name = "GameState"
	add_child(game_state)

	player.speed_changed.connect(hud.set_speed)
	player.mode_changed.connect(hud.set_mode)
	player.trick_called.connect(hud.show_trick)
	player.prompt_changed.connect(hud.set_prompt)
	game_state.money_changed.connect(hud.set_money)
	game_state.rep_changed.connect(hud.set_reputation)
	game_state.health_changed.connect(hud.set_health)
	game_state._emit_all()
	hud.set_mode("SKATE")


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("heal") and game_state:
		game_state.use_first_healing_item()
	if event.is_action_pressed("pause"):
		if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
			get_tree().paused = true
			hud.set_pause_visible(true)
		else:
			get_tree().paused = false
			hud.set_pause_visible(false)
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _register_input_map() -> void:
	_add_key_action("move_forward", KEY_W)
	_add_key_action("move_back", KEY_S)
	_add_key_action("move_left", KEY_A)
	_add_key_action("move_right", KEY_D)
	_add_key_action("ollie", KEY_SPACE)
	_add_key_action("trick", KEY_F)
	_add_key_action("toggle_mode", KEY_TAB)
	_add_key_action("interact", KEY_E)
	_add_key_action("reset_player", KEY_R)
	_add_key_action("pause", KEY_ESCAPE)
	_add_key_action("sprint", KEY_SHIFT)
	_add_key_action("inventory", KEY_I)
	_add_key_action("heal", KEY_H)


func _add_key_action(action: StringName, keycode: Key) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	var event := InputEventKey.new()
	event.physical_keycode = keycode
	if not InputMap.action_has_event(action, event):
		InputMap.action_add_event(action, event)
