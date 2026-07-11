class_name GrindRail
extends Node3D

var start_point := Vector3.ZERO
var end_point := Vector3.FORWARD
var thickness := 0.11


func setup(start: Vector3, finish: Vector3, rail_color := Color("#727b80")) -> void:
	start_point = start
	end_point = finish
	position = (start + finish) * 0.5
	look_at(finish, Vector3.UP)
	add_to_group("grind_rails")

	var length := start.distance_to(finish)
	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(thickness, thickness, length)
	mesh.material = _material(rail_color, 0.35, 0.72)
	mesh_instance.mesh = mesh
	mesh_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	add_child(mesh_instance)

	var body := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(thickness, thickness, length)
	shape.shape = box
	body.add_child(shape)
	add_child(body)

	for point in [start, finish]:
		var post := MeshInstance3D.new()
		var post_mesh := BoxMesh.new()
		post_mesh.size = Vector3(thickness * 0.7, maxf(point.y, 0.2), thickness * 0.7)
		post_mesh.material = mesh.material
		post.mesh = post_mesh
		post.position = to_local(Vector3(point.x, point.y * 0.5, point.z))
		add_child(post)


func closest_t(world_position: Vector3) -> float:
	var line := end_point - start_point
	var length_squared := line.length_squared()
	if length_squared < 0.0001:
		return 0.0
	return clampf((world_position - start_point).dot(line) / length_squared, 0.0, 1.0)


func point_at(t: float) -> Vector3:
	return start_point.lerp(end_point, clampf(t, 0.0, 1.0))


func distance_to_rail(world_position: Vector3) -> float:
	return world_position.distance_to(point_at(closest_t(world_position)))


func _material(color: Color, roughness: float, metallic: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	material.metallic = metallic
	return material
