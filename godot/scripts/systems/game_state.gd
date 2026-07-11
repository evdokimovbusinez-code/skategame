class_name GameState
extends Node

signal money_changed(balance: int, delta: int)
signal rep_changed(rep: int, level_name: String, fraction: float)
signal health_changed(health: int, maximum: int)
signal inventory_changed(items: Array[String])

const SAVE_PATH := "user://sk8town-save-v1.json"

const REP_LEVELS := [
	{"name": "Nobody", "threshold": 0},
	{"name": "Poser", "threshold": 60},
	{"name": "Local", "threshold": 150},
	{"name": "Known", "threshold": 280},
	{"name": "Legend", "threshold": 450},
]

const ITEMS := {
	"sixpack": {"name": "Party Snacks", "type": "quest", "stackable": false},
	"spraycan": {"name": "Spray Paint", "type": "gear", "stackable": false},
	"vhs1": {"name": "Tape: FoodMart Roof", "type": "collectible", "stackable": false},
	"vhs2": {"name": "Tape: Senior Wall", "type": "collectible", "stackable": false},
	"vhs3": {"name": "Tape: Back Alley", "type": "collectible", "stackable": false},
	"package": {"name": "Mixtape Box", "type": "quest", "stackable": false},
	"deck_street": {"name": "Street Deck", "type": "gear", "stackable": false},
	"deck_pro": {"name": "Pro Deck", "type": "gear", "stackable": false},
	"convenience_snack": {"name": "Corner Store Snack", "type": "consumable", "stackable": true, "heal": 28},
	"first_aid_tape": {"name": "First Aid Tape", "type": "consumable", "stackable": true, "heal": 55},
	"lucky_sticker": {"name": "Lucky Sticker", "type": "collectible", "stackable": true},
}

var money := 0
var rep := 0
var health := 100
var max_health := 100
var story_stage := 0
var inventory: Array[String] = []
var completed_quests: Array[String] = []


func _ready() -> void:
	load_game()
	_emit_all()


func add_money(delta: int) -> void:
	money = maxi(0, money + delta)
	money_changed.emit(money, delta)
	save_game()


func spend(amount: int) -> bool:
	if money < amount:
		return false
	add_money(-amount)
	return true


func add_rep(delta: int) -> void:
	rep = maxi(0, rep + delta)
	var level := get_rep_level()
	rep_changed.emit(rep, level.name, get_rep_fraction())
	save_game()


func take_damage(amount: int) -> void:
	health = maxi(0, health - maxi(amount, 0))
	health_changed.emit(health, max_health)
	save_game()


func heal(amount: int) -> void:
	health = mini(max_health, health + maxi(amount, 0))
	health_changed.emit(health, max_health)
	save_game()


func add_item(id: String) -> bool:
	if not ITEMS.has(id):
		return false
	if not bool(ITEMS[id].stackable) and inventory.has(id):
		return false
	inventory.append(id)
	inventory_changed.emit(inventory)
	save_game()
	return true


func remove_item(id: String) -> bool:
	var index := inventory.find(id)
	if index < 0:
		return false
	inventory.remove_at(index)
	inventory_changed.emit(inventory)
	save_game()
	return true


func use_first_healing_item() -> bool:
	for id in inventory:
		var item: Dictionary = ITEMS[id]
		if item.type == "consumable":
			var amount := int(item.get("heal", 0))
			remove_item(id)
			heal(amount)
			return true
	return false


func get_rep_level() -> Dictionary:
	var current: Dictionary = REP_LEVELS[0]
	for level in REP_LEVELS:
		if rep >= int(level.threshold):
			current = level
	return current


func get_rep_fraction() -> float:
	var current := get_rep_level()
	var index := REP_LEVELS.find(current)
	if index >= REP_LEVELS.size() - 1:
		return 1.0
	var next: Dictionary = REP_LEVELS[index + 1]
	return float(rep - int(current.threshold)) / float(int(next.threshold) - int(current.threshold))


func save_game() -> void:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if not file:
		return
	file.store_string(JSON.stringify({
		"money": money,
		"rep": rep,
		"health": health,
		"inventory": inventory,
		"completedQuests": completed_quests,
		"storyStage": story_stage,
	}))


func load_game() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	var data = JSON.parse_string(file.get_as_text())
	if not data is Dictionary:
		return
	money = int(data.get("money", 0))
	rep = int(data.get("rep", 0))
	health = clampi(int(data.get("health", max_health)), 1, max_health)
	inventory.assign(data.get("inventory", []))
	completed_quests.assign(data.get("completedQuests", []))
	story_stage = int(data.get("storyStage", 0))


func _emit_all() -> void:
	money_changed.emit(money, 0)
	var level := get_rep_level()
	rep_changed.emit(rep, level.name, get_rep_fraction())
	health_changed.emit(health, max_health)
	inventory_changed.emit(inventory)
