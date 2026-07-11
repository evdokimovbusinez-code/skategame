class_name ExactCollisionWorld
extends Node3D

const DATA_PATH := "res://assets/world/sk8town_colliders.json"


func _ready() -> void:
	var file := FileAccess.open(DATA_PATH, FileAccess.READ)
	if not file:
		push_error("Missing exact collider data: " + DATA_PATH)
		return
	var data = JSON.parse_string(file.get_as_text())
	if not data is Array:
		push_error("Invalid exact collider data")
		return
	for item in data:
		_build_collider(item)


func _build_collider(item: Dictionary) -> void:
	var shape: Shape3D
	var type := int(item.type)
	if type == 1:
		var box := BoxShape3D.new()
		box.size = _vector(item.halfExtents) * 2.0
		shape = box
	elif type == 6:
		var mesh := ConcavePolygonShape3D.new()
		var source_vertices := _vertices(item.get("vertices", []))
		var indices: Array = item.get("indices", [])
		var faces := PackedVector3Array()
		if indices.is_empty():
			faces = source_vertices
		else:
			for index in indices:
				faces.append(source_vertices[int(index)])
		mesh.set_faces(faces)
		shape = mesh
	elif type == 9:
		var convex := ConvexPolygonShape3D.new()
		convex.points = _vertices(item.get("vertices", []))
		shape = convex
	elif type == 0:
		var sphere := SphereShape3D.new()
		sphere.radius = float(item.radius)
		shape = sphere
	elif type == 2:
		var capsule := CapsuleShape3D.new()
		capsule.radius = float(item.radius)
		capsule.height = float(item.halfHeight) * 2.0 + capsule.radius * 2.0
		shape = capsule
	elif type == 10:
		var cylinder := CylinderShape3D.new()
		cylinder.radius = float(item.radius)
		cylinder.height = float(item.halfHeight) * 2.0
		shape = cylinder
	else:
		return

	var body := StaticBody3D.new()
	var collision := CollisionShape3D.new()
	collision.shape = shape
	body.add_child(collision)
	body.position = _vector(item.position)
	var rotation: Array = item.rotation
	body.quaternion = Quaternion(float(rotation[0]), float(rotation[1]), float(rotation[2]), float(rotation[3]))
	add_child(body)


func _vector(values: Array) -> Vector3:
	return Vector3(float(values[0]), float(values[1]), float(values[2]))


func _vertices(values: Array) -> PackedVector3Array:
	var result := PackedVector3Array()
	for index in range(0, values.size(), 3):
		result.append(Vector3(float(values[index]), float(values[index + 1]), float(values[index + 2])))
	return result
