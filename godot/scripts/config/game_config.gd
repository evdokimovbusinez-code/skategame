class_name GameConfig
extends RefCounted

# Exact tuning values ported from src/config/constants.ts.
const GRAVITY := 21.582
const FIXED_TIMESTEP := 1.0 / 60.0

const PLAYER_SPAWN := Vector3(4.0, 2.0, 10.5)
const CAPSULE_RADIUS := 0.32
const CAPSULE_HALF_HEIGHT := 0.35

const WALK_MAX_SPEED := 3.4
const WALK_SPRINT_MULTIPLIER := 1.85
const WALK_ACCELERATION := 16.0
const WALK_DECELERATION := 20.0
const WALK_TURN_RATE := 620.0
const WALK_JUMP_IMPULSE := 8.0

const SKATE_MAX_SPEED := 12.5
const SKATE_PUSH_ACCELERATION := 14.5
const SKATE_PUSH_BURST_FRACTION := 0.34
const SKATE_ROLL_ACCELERATION := 3.2
const SKATE_GROUND_FRICTION := 0.075
const SKATE_AIR_FRICTION := 0.025
const SKATE_LOW_SPEED_TURN_RATE := 135.0
const SKATE_MAX_SPEED_TURN_RATE := 70.0
const SKATE_BRAKE_DECELERATION := 12.0
const SKATE_SIDE_GRIP := 6.2
const SKATE_POWERSLIDE_GRIP := 1.45
const SKATE_SLOPE_GRAVITY := 0.55
const SKATE_AIR_TURN_RATE := 58.0
const SKATE_LEAN_MAX := 0.34
const SKATE_LEAN_SMOOTHING := 9.0
const MODE_TOGGLE_MAX_SPEED := 1.5

const OLLIE_IMPULSE := 5.9
const OLLIE_MAX_IMPULSE := 8.1
const OLLIE_CHARGE_SECONDS := 0.38
const KICKFLIP_DURATION := 0.55
const COYOTE_TIME := 0.12
const JUMP_BUFFER_TIME := 0.15
const COMBO_WINDOW := 3.0

const GRIND_MIN_ENTRY_SPEED := 2.5
const GRIND_SNAP_DISTANCE := 0.9
const GRIND_EXIT_BOOST := 3.0

const RAGDOLL_FALL_HEIGHT := 3.2
const RAGDOLL_IMPACT_SPEED_DELTA := 7.0
const RAGDOLL_TIMEOUT := 2.5
const RESPAWN_GRACE := 0.5

const CAMERA_SKATE := {"distance": 5.1, "height": 2.15, "look_height": 0.78, "smoothing": 6.0}
const CAMERA_WALK := {"distance": 3.9, "height": 1.75, "look_height": 0.82, "smoothing": 7.0}
const CAMERA_GRIND := {"distance": 6.2, "height": 2.8, "look_height": 1.2, "smoothing": 5.0}
const CAMERA_BASE_FOV := 60.0
const CAMERA_MAX_FOV_BOOST := 9.0
const CAMERA_LOOK_AHEAD := 1.6

const INTERACTION_RADIUS := 2.2

const SCORE := {
	"ollie": 45,
	"kickflip": 150,
	"heelflip": 160,
	"shove": 140,
	"three_shove": 240,
	"varial": 260,
	"three_sixty_flip": 420,
	"body_180": 120,
	"body_360": 260,
	"clean_landing": 25,
}

const DAY_CYCLE_SECONDS := 900.0
const DAY_START := 0.46
