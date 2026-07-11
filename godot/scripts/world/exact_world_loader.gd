class_name ExactWorldLoader
extends Node3D

const CHUNK_PATTERN := "res://assets/world/chunks/sk8town_world.glb.part%02d"


func _ready() -> void:
	var bytes := PackedByteArray()
	var index := 0
	while true:
		var path := CHUNK_PATTERN % index
		if not FileAccess.file_exists(path):
			break
		bytes.append_array(FileAccess.get_file_as_bytes(path))
		index += 1
	if bytes.is_empty():
		push_error("Exact SK8TOWN world chunks are missing")
		return
	var document := GLTFDocument.new()
	var state := GLTFState.new()
	var error := document.append_from_buffer(bytes, "res://assets/world/", state)
	if error != OK:
		push_error("Could not decode exact SK8TOWN world: %s" % error_string(error))
		return
	var scene := document.generate_scene(state)
	if not scene:
		push_error("Could not generate exact SK8TOWN world scene")
		return
	scene.name = "ExactWebWorld"
	add_child(scene)
