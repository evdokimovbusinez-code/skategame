class_name SkateNPC
extends Node3D

var display_name := "LOCAL SKATER"
var message := "Keep pushing."
var phase := 0.0
var visual := Node3D.new()


func setup(npc_name: String, dialogue: String, shirt_color: Color, accent: Color) -> void:
	display_name = npc_name
	message = dialogue
	add_to_group("interactables")
	visual.name = "Visual"
	add_child(visual)
	_build_character(shirt_color, accent)
	_build_marker()


func _process(delta: float) -> void:
	phase += delta
	visual.position.y = sin(phase * 1.4) * 0.015
	visual.rotation.z = sin(phase * 0.72) * 0.012


func interact() -> String:
	return display_name + ": " + message


func _build_character(shirt_color: Color, accent: Color) -> void:
	_add_box(visual, Vector3(0.46, 0.55, 0.26), Vector3(0, 1.05, 0), shirt_color)
	_add_box(visual, Vector3(0.34, 0.34, 0.3), Vector3(0, 1.52, 0), Color("#c98f5f"))
	_add_box(visual, Vector3(0.42, 0.18, 0.32), Vector3(0, 1.72, 0), accent)
	for side in [-1.0, 1.0]:
		_add_box(visual, Vector3(0.16, 0.58, 0.18), Vector3(side * 0.29, 1.0, 0), shirt_color)
		_add_box(visual, Vector3(0.18, 0.72, 0.2), Vector3(side * 0.13, 0.42, 0), Color("#20232b"))
		_add_box(visual, Vector3(0.24, 0.12, 0.42), Vector3(side * 0.13, 0.08, -0.06), Color("#e7dfd1"))
	_add_box(visual, Vector3(0.05, 0.04, 0.025), Vector3(-0.07, 1.55, -0.16), Color("#151515"))
	_add_box(visual, Vector3(0.05, 0.04, 0.025), Vector3(0.07, 1.55, -0.16), Color("#151515"))


func _build_marker() -> void:
	var label := Label3D.new()
	label.text = "!"
	label.font_size = 80
	label.modulate = Color("#d8ff3e")
	label.outline_modulate = Color("#111311")
	label.outline_size = 12
	label.position = Vector3(0, 2.25, 0)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	add_child(label)


func _add_box(parent: Node3D, size: Vector3, at: Vector3, color: Color) -> void:
	var instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.82
	mesh.material = material
	instance.mesh = mesh
	instance.position = at
	parent.add_child(instance)
