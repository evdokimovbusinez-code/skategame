class_name SkateHUD
extends CanvasLayer

var speed_bar: ProgressBar
var mode_label: Label
var prompt_label: Label
var trick_label: Label
var score_label: Label
var pause_layer: Control
var total_score := 0
var trick_tween: Tween

const INK := Color("#0b0a0d")
const PAPER := Color("#e6ded0")
const ACID := Color("#ffcc24")
const PINK := Color("#ee2677")
const ORANGE := Color("#ff632d")


func _ready() -> void:
	layer = 10
	process_mode = Node.PROCESS_MODE_ALWAYS
	_build_hud()


func set_speed(value: float) -> void:
	if speed_bar:
		speed_bar.value = clampf(value, 0.0, 1.0) * 100.0


func set_mode(value: String) -> void:
	if mode_label:
		mode_label.text = value


func set_prompt(text: String) -> void:
	if not prompt_label:
		return
	prompt_label.text = text
	prompt_label.visible = not text.is_empty()


func show_trick(trick_name: String, score: int) -> void:
	total_score += score
	score_label.text = "%06d" % total_score
	trick_label.text = "%s\n+%d" % [trick_name, score]
	trick_label.modulate = Color.WHITE
	trick_label.scale = Vector2(0.82, 0.82)
	if trick_tween and trick_tween.is_valid():
		trick_tween.kill()
	trick_tween = create_tween().set_parallel(true)
	trick_tween.tween_property(trick_label, "scale", Vector2.ONE, 0.16).set_trans(Tween.TRANS_BACK)
	trick_tween.tween_property(trick_label, "modulate:a", 0.0, 0.42).set_delay(1.0)


func set_pause_visible(visible: bool) -> void:
	if pause_layer:
		pause_layer.visible = visible


func _build_hud() -> void:
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	var brand := Label.new()
	brand.text = "BURNOUT\nCITY"
	brand.position = Vector2(28, 24)
	brand.add_theme_font_size_override("font_size", 31)
	brand.add_theme_color_override("font_color", PAPER)
	brand.add_theme_color_override("font_shadow_color", PINK)
	brand.add_theme_constant_override("shadow_offset_x", 3)
	brand.add_theme_constant_override("shadow_offset_y", 3)
	root.add_child(brand)

	var mission := _panel(Vector2(24, 116), Vector2(326, 105), Color(0.03, 0.025, 0.035, 0.90), PINK)
	root.add_child(mission)
	var mission_title := _label("DIY OR DIE", Vector2(17, 12), 17, ACID)
	mission.add_child(mission_title)
	var mission_body := _label("●  MEET THE LOCAL CREW\n    AT THE BURNOUT SHOP", Vector2(17, 43), 15, PAPER)
	mission.add_child(mission_body)

	var stats := _panel(Vector2(-258, 24), Vector2(230, 102), Color(0.03, 0.025, 0.035, 0.90), ORANGE)
	stats.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	root.add_child(stats)
	stats.add_child(_label("CASH   $128", Vector2(15, 12), 19, Color("#77ec8b")))
	stats.add_child(_label("REP    ★★☆☆☆", Vector2(15, 42), 16, ACID))
	score_label = _label("000000", Vector2(15, 69), 17, PAPER)
	stats.add_child(score_label)

	var motion := _panel(Vector2(24, -145), Vector2(295, 116), Color(0.03, 0.025, 0.035, 0.90), ACID)
	motion.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	root.add_child(motion)
	mode_label = _label("SKATE", Vector2(15, 10), 24, ACID)
	motion.add_child(mode_label)
	motion.add_child(_label("SPEED / FLOW", Vector2(16, 49), 13, PAPER))
	speed_bar = ProgressBar.new()
	speed_bar.position = Vector2(15, 74)
	speed_bar.size = Vector2(264, 20)
	speed_bar.show_percentage = false
	speed_bar.add_theme_stylebox_override("background", _style(INK, PAPER, 1, 1))
	speed_bar.add_theme_stylebox_override("fill", _style(PINK, PINK, 0, 0))
	motion.add_child(speed_bar)

	trick_label = _label("", Vector2.ZERO, 31, ACID)
	trick_label.set_anchors_preset(Control.PRESET_CENTER)
	trick_label.position = Vector2(-115, -190)
	trick_label.size = Vector2(230, 100)
	trick_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	trick_label.pivot_offset = trick_label.size * 0.5
	trick_label.add_theme_color_override("font_shadow_color", PINK)
	trick_label.add_theme_constant_override("shadow_offset_x", 3)
	trick_label.add_theme_constant_override("shadow_offset_y", 3)
	root.add_child(trick_label)

	prompt_label = _label("", Vector2.ZERO, 17, PAPER)
	prompt_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	prompt_label.position = Vector2(-230, -105)
	prompt_label.size = Vector2(460, 48)
	prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	prompt_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	prompt_label.add_theme_stylebox_override("normal", _style(Color(0.02, 0.02, 0.025, 0.94), ACID, 2, 5))
	prompt_label.visible = false
	root.add_child(prompt_label)

	var hints := _label("WASD  RIDE    SPACE  OLLIE    F  KICKFLIP    TAB  WALK", Vector2.ZERO, 13, Color(0.86, 0.83, 0.76, 0.8))
	hints.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	hints.position = Vector2(-500, -38)
	hints.size = Vector2(475, 24)
	hints.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	root.add_child(hints)

	pause_layer = Control.new()
	pause_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	pause_layer.mouse_filter = Control.MOUSE_FILTER_STOP
	pause_layer.process_mode = Node.PROCESS_MODE_ALWAYS
	pause_layer.visible = false
	root.add_child(pause_layer)
	var veil := ColorRect.new()
	veil.color = Color(0.015, 0.012, 0.02, 0.88)
	veil.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	pause_layer.add_child(veil)
	var pause_title := _label("SESSION PAUSED", Vector2.ZERO, 54, ACID)
	pause_title.set_anchors_preset(Control.PRESET_CENTER)
	pause_title.position = Vector2(-280, -105)
	pause_title.size = Vector2(560, 80)
	pause_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	pause_title.add_theme_color_override("font_shadow_color", PINK)
	pause_title.add_theme_constant_override("shadow_offset_x", 5)
	pause_title.add_theme_constant_override("shadow_offset_y", 5)
	pause_layer.add_child(pause_title)
	var pause_help := _label("ESC  BACK TO THE STREETS\nR  RESET SKATER", Vector2.ZERO, 19, PAPER)
	pause_help.set_anchors_preset(Control.PRESET_CENTER)
	pause_help.position = Vector2(-220, 0)
	pause_help.size = Vector2(440, 80)
	pause_help.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	pause_layer.add_child(pause_help)


func _panel(position: Vector2, size: Vector2, fill: Color, border: Color) -> Panel:
	var panel := Panel.new()
	panel.position = position
	panel.size = size
	panel.add_theme_stylebox_override("panel", _style(fill, border, 2, 6))
	return panel


func _label(text: String, position: Vector2, font_size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.position = position
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	return label


func _style(fill: Color, border: Color, width: int, radius: int) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = border
	style.set_border_width_all(width)
	style.set_corner_radius_all(radius)
	return style
