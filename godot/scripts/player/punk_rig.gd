class_name PunkRig
extends Node3D

const HIP_HEIGHT := 0.7
const UPPER_LEG_LEN := 0.35
const LOWER_LEG_LEN := 0.34
const SPINE_PIVOT := 0.1
const SPINE_LEN := 0.52
const SHOULDER_DROP := 0.15
const UPPER_ARM_LEN := 0.31
const LOWER_ARM_LEN := 0.28

var hips: Node3D
var spine: Node3D
var head: Node3D
var left_upper_arm: Node3D
var left_lower_arm: Node3D
var right_upper_arm: Node3D
var right_lower_arm: Node3D
var left_upper_leg: Node3D
var left_lower_leg: Node3D
var left_foot: Node3D
var right_upper_leg: Node3D
var right_lower_leg: Node3D
var right_foot: Node3D
var board: Node3D

var skin := Color("#d19a69")
var shirt := Color("#171519")
var pants := Color("#15171d")
var shoes := Color("#101010")


func build() -> void:
	hips = _joint("Hips", self, Vector3(0, HIP_HEIGHT, 0))
	_box(hips, Vector3(0.42, 0.14, 0.26), Vector3(0, 0.035, 0), pants)
	_box(hips, Vector3(0.46, 0.06, 0.28), Vector3(0, 0.135, 0.005), pants)

	spine = _joint("Spine", hips, Vector3(0, SPINE_PIVOT, 0))
	_taper(spine, 0.2, 0.29, SPINE_LEN, Vector3(0, SPINE_LEN * 0.5, 0), shirt)
	_box(spine, Vector3(0.55, 0.09, 0.23), Vector3(0, SPINE_LEN - 0.12, 0), shirt)
	_box(spine, Vector3(0.13, 0.085, 0.13), Vector3(0, SPINE_LEN - 0.035, 0), skin)

	head = _joint("Head", spine, Vector3(0, SPINE_LEN, 0))
	_box(head, Vector3(0.27, 0.3, 0.25), Vector3(0, 0.155, 0), skin)
	_sphere(head, 0.032, Vector3(-0.15, 0.149, 0), skin)
	_sphere(head, 0.032, Vector3(0.15, 0.149, 0), skin)
	_build_face()
	_build_mohawk()

	var left_arm := _build_arm(-1.0)
	left_upper_arm = left_arm[0]
	left_lower_arm = left_arm[1]
	var right_arm := _build_arm(1.0)
	right_upper_arm = right_arm[0]
	right_lower_arm = right_arm[1]
	var left_leg := _build_leg(-1.0)
	left_upper_leg = left_leg[0]
	left_lower_leg = left_leg[1]
	left_foot = left_leg[2]
	var right_leg := _build_leg(1.0)
	right_upper_leg = right_leg[0]
	right_lower_leg = right_leg[1]
	right_foot = right_leg[2]

	_build_vest()
	_build_board()


func _build_arm(side: float) -> Array[Node3D]:
	var upper := _joint("LeftUpperArm" if side < 0 else "RightUpperArm", spine, Vector3(side * 0.275, SPINE_LEN - SHOULDER_DROP, 0))
	_capsule(upper, UPPER_ARM_LEN, 0.06, Vector3(0, -UPPER_ARM_LEN * 0.5, 0), shirt)
	var lower := _joint("LeftLowerArm" if side < 0 else "RightLowerArm", upper, Vector3(0, -UPPER_ARM_LEN, 0))
	_capsule(lower, LOWER_ARM_LEN, 0.048, Vector3(0, -LOWER_ARM_LEN * 0.5, 0), skin)
	_box(lower, Vector3(0.085, 0.055, 0.07), Vector3(0, -LOWER_ARM_LEN - 0.025, 0.014), skin)
	_build_wrist_studs(lower)
	return [upper, lower]


func _build_leg(side: float) -> Array[Node3D]:
	var upper := _joint("LeftUpperLeg" if side < 0 else "RightUpperLeg", hips, Vector3(side * 0.125, 0, 0))
	_capsule(upper, UPPER_LEG_LEN, 0.078, Vector3(0, -UPPER_LEG_LEN * 0.5, 0), pants)
	var lower := _joint("LeftLowerLeg" if side < 0 else "RightLowerLeg", upper, Vector3(0, -UPPER_LEG_LEN, 0))
	_capsule(lower, LOWER_LEG_LEN, 0.068, Vector3(0, -LOWER_LEG_LEN * 0.5, 0), pants)
	var foot := _joint("LeftFoot" if side < 0 else "RightFoot", lower, Vector3(0, -LOWER_LEG_LEN, 0))
	_box(foot, Vector3(0.2, 0.09, 0.37), Vector3(0, 0.025, 0.072), shoes)
	_box(foot, Vector3(0.22, 0.03, 0.4), Vector3(0, -0.035, 0.072), Color("#f1ead8"))
	_box(foot, Vector3(0.18, 0.028, 0.12), Vector3(0, 0.05, 0.245), Color("#f1ead8"))
	return [upper, lower, foot]


func _build_face() -> void:
	for x in [-0.063, 0.063]:
		_box(head, Vector3(0.072, 0.047, 0.014), Vector3(x, 0.185, -0.137), Color("#e9e2d3"))
		_box(head, Vector3(0.027, 0.036, 0.012), Vector3(x * 0.86, 0.183, -0.151), Color("#161616"))
		var brow := _box(head, Vector3(0.07, 0.018, 0.016), Vector3(x * 0.95, 0.225, -0.142), Color("#23151d"))
		brow.rotation.z = 0.15 if x < 0 else -0.15
	_box(head, Vector3(0.034, 0.05, 0.026), Vector3(0, 0.135, -0.154), Color("#b9784f"))
	_box(head, Vector3(0.09, 0.015, 0.012), Vector3(0, 0.085, -0.144), Color("#5a2d2b"))


func _build_mohawk() -> void:
	_box(head, Vector3(0.285, 0.06, 0.255), Vector3(0, 0.315, 0), Color("#1a1020"))
	var fringe := _box(head, Vector3(0.22, 0.07, 0.085), Vector3(0, 0.27, -0.125), Color("#1a1020"))
	fringe.rotation.x = -0.18
	for index in range(9):
		var t := index / 8.0
		var z := -0.15 + t * 0.3
		var height := 0.16 + sin(t * PI) * 0.1
		var tuft := _cone(head, 0.055, height, Vector3(0, 0.365 + height * 0.5, z), Color("#b5368c") if index % 2 else Color("#5b1f65"))
		tuft.rotation.x = (0.5 - t) * 0.55
		tuft.rotation.z = 0.18 if index % 2 else -0.18
	for side in [-1.0, 1.0]:
		for index in range(3):
			var spike := _cone(head, 0.04, 0.14 + index * 0.025, Vector3(side * (0.12 + index * 0.025), 0.36, -0.08 + index * 0.075), Color("#5b1f65"))
			spike.rotation.z = -side * 0.85
	_box(head, Vector3(0.055, 0.16, 0.045), Vector3(-0.14, 0.19, 0.02), Color("#1a1020"))
	_box(head, Vector3(0.055, 0.16, 0.045), Vector3(0.14, 0.19, 0.02), Color("#1a1020"))


func _build_vest() -> void:
	_box(spine, Vector3(0.58, 0.48, 0.29), Vector3(0, 0.25, 0), Color("#111113"))
	_box(spine, Vector3(0.42, 0.28, 0.018), Vector3(0, 0.27, -0.155), Color("#d8d0c5"))
	_box(spine, Vector3(0.36, 0.075, 0.02), Vector3(0, 0.105, -0.157), Color("#bf463e"))
	for side in [-1.0, 1.0]:
		for index in range(5):
			_cone(spine, 0.014, 0.04, Vector3(side * 0.265, 0.08 + index * 0.09, -0.16), Color("#d8d0c5"))


func _build_wrist_studs(parent: Node3D) -> void:
	_box(parent, Vector3(0.12, 0.07, 0.1), Vector3(0, -0.235, 0), Color("#111111"))
	for x in [-0.035, 0.035]:
		_cone(parent, 0.014, 0.04, Vector3(x, -0.278, -0.04), Color("#d8d0c5"))


func _build_board() -> void:
	board = _joint("Skateboard", self, Vector3(0, 0.14, 0))
	_box(board, Vector3(0.31, 0.04, 1.02), Vector3.ZERO, Color("#123b43"))
	_box(board, Vector3(0.22, 0.008, 0.66), Vector3(0, 0.026, 0), Color("#151515"))
	_box(board, Vector3(0.25, 0.008, 0.72), Vector3(0, 0.032, 0), Color("#b98248"))
	for z in [-0.33, 0.33]:
		_box(board, Vector3(0.25, 0.035, 0.07), Vector3(0, -0.045, z), Color("#d0c9bb"))
		var axle := _cylinder(board, 0.014, 0.36, Vector3(0, -0.06, z), Color("#777777"))
		axle.rotation.z = PI * 0.5
		for x in [-0.18, 0.18]:
			var wheel := _cylinder(board, 0.058, 0.07, Vector3(x, -0.067, z), Color("#e9e0d2"))
			wheel.rotation.z = PI * 0.5


func _joint(node_name: String, parent: Node3D, at: Vector3) -> Node3D:
	var joint := Node3D.new()
	joint.name = node_name
	joint.position = at
	parent.add_child(joint)
	return joint


func _box(parent: Node3D, size: Vector3, at: Vector3, color: Color) -> MeshInstance3D:
	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = _material(color)
	mesh_instance.mesh = mesh
	mesh_instance.position = at
	parent.add_child(mesh_instance)
	return mesh_instance


func _capsule(parent: Node3D, length: float, radius: float, at: Vector3, color: Color) -> MeshInstance3D:
	var mesh_instance := MeshInstance3D.new()
	var mesh := CapsuleMesh.new()
	mesh.radius = radius
	mesh.height = length
	mesh.radial_segments = 7
	mesh.rings = 2
	mesh.material = _material(color)
	mesh_instance.mesh = mesh
	mesh_instance.position = at
	parent.add_child(mesh_instance)
	return mesh_instance


func _taper(parent: Node3D, top: float, bottom: float, height: float, at: Vector3, color: Color) -> MeshInstance3D:
	var mesh_instance := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = top
	mesh.bottom_radius = bottom
	mesh.height = height
	mesh.radial_segments = 7
	mesh.material = _material(color)
	mesh_instance.mesh = mesh
	mesh_instance.position = at
	parent.add_child(mesh_instance)
	return mesh_instance


func _cone(parent: Node3D, radius: float, height: float, at: Vector3, color: Color) -> MeshInstance3D:
	return _taper(parent, 0.0, radius, height, at, color)


func _cylinder(parent: Node3D, radius: float, height: float, at: Vector3, color: Color) -> MeshInstance3D:
	return _taper(parent, radius, radius, height, at, color)


func _sphere(parent: Node3D, radius: float, at: Vector3, color: Color) -> MeshInstance3D:
	var mesh_instance := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	mesh.radial_segments = 7
	mesh.rings = 5
	mesh.material = _material(color)
	mesh_instance.mesh = mesh
	mesh_instance.position = at
	parent.add_child(mesh_instance)
	return mesh_instance


func _material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.82
	return material
