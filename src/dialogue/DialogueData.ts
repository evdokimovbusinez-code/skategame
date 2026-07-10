export interface DialogueLine {
  speaker: string;
  text: string;
}

export interface DialogueChoice {
  text: string;
  next?: string; // node to jump to; omit = end dialogue
  onPick?: () => void; // rewards, flags, quest starts
}

export interface DialogueNode {
  id: string;
  lines: DialogueLine[];
  /** Linear follow-up. Ignored if `choices` is present on the last line. */
  next?: string;
  /** Player-picked branches, shown after the node's last line. */
  choices?: DialogueChoice[];
  onEnter?: () => void;
}

export interface DialogueTree {
  start: string;
  nodes: Record<string, DialogueNode>;
}

// ---------------------------------------------------------------------------
// Tyler — the 2000s teen-movie crew leader. Snack run -> alley poster -> homecoming line.
// ---------------------------------------------------------------------------

export function buildCrewIntroDialogue(hooks: {
  onAccept: () => void;
  onHaggle: () => void; // accepted, but negotiated a bigger cash cut (less rep)
}): DialogueTree {
  return {
    start: "intro1",
    nodes: {
      intro1: {
        id: "intro1",
        lines: [{ speaker: "Tyler", text: "Новенький? В Ridgeway после заката все либо в FoodMart, либо на споте." }],
        next: "intro2",
      },
      intro2: {
        id: "intro2",
        lines: [
          { speaker: "Tyler", text: "Хочешь кататься с нами на Homecoming Jam — сначала докажи, что не турист." },
          { speaker: "Tyler", text: "В FoodMart касса завалена снеками и газировкой. Возьми набор для вечеринки и выйди без взгляда клерка." },
        ],
        choices: [
          { text: "Сделаю. Как в кино.", next: "accept", onPick: hooks.onAccept },
          { text: "За такую сцену мне нужны деньги.", next: "haggle" },
          { text: "Я пока осмотрюсь. (уйти)" },
        ],
      },
      accept: {
        id: "accept",
        lines: [{ speaker: "Tyler", text: "Именно. Клерк смотрит на проходы и кассу. Пользуйся стеллажами, выйди через стеклянный вход." }],
      },
      haggle: {
        id: "haggle",
        lines: [{ speaker: "Tyler", text: "Ха, деловой. Ладно, дам больше кэша. Но легендой становятся не за сдачу у кассы." }],
        choices: [
          { text: "Кэш тоже часть легенды. По рукам.", next: "haggleDone", onPick: hooks.onHaggle },
          { text: "Ладно, сделаю ради сцены.", next: "accept", onPick: hooks.onAccept },
        ],
      },
      haggleDone: {
        id: "haggleDone",
        lines: [{ speaker: "Tyler", text: "Кэш после дела. И не зацепи тележки у входа." }],
      },
    },
  };
}

export function buildCrewFollowUpDialogue(onStartMission: () => void): DialogueTree {
  return {
    start: "followup1",
    nodes: {
      followup1: {
        id: "followup1",
        lines: [
          { speaker: "Tyler", text: "Окей, у тебя есть timing. Теперь нужна подпись." },
          { speaker: "Tyler", text: "В back alley висит пустая стена под афишу Homecoming Jam. Закрась её нашим знаком." },
        ],
        choices: [
          { text: "Поставлю афишу на весь квартал.", onPick: onStartMission },
          { text: "Сначала осмотрюсь. (позже)" },
        ],
      },
    },
  };
}

export function buildTrickChallengeDialogue(onStart: () => void): DialogueTree {
  return {
    start: "tc1",
    nodes: {
      tc1: {
        id: "tc1",
        lines: [
          { speaker: "Tyler", text: "Теперь финальная сцена. Камера на тебе, парковка пустая, все смотрят." },
          { speaker: "Tyler", text: "500 очков за 60 секунд в DIY-парке. Рампы, перила, комбо — сделай line, который будут пересказывать в понедельник." },
        ],
        choices: [
          { text: "Погнали. Засекай.", onPick: onStart },
          { text: "Дай размяться. (позже)" },
        ],
      },
    },
  };
}

export function buildCrewFinalDialogue(): DialogueTree {
  return {
    start: "final1",
    nodes: {
      final1: {
        id: "final1",
        lines: [
          { speaker: "Tyler", text: "Вот это была сцена. Ты не просто новенький." },
          { speaker: "Tyler", text: "Добро пожаловать в crew. Homecoming Jam теперь и твой фильм тоже." },
        ],
      },
    },
  };
}

/** Shown while a Jax mission is still in progress. */
export function buildJaxBusyDialogue(hintText: string): DialogueTree {
  return {
    start: "busy",
    nodes: {
      busy: { id: "busy", lines: [{ speaker: "Tyler", text: hintText }] },
    },
  };
}

// ---------------------------------------------------------------------------
// Mia — FoodMart cashier / local skate-shop hookup. Shop access + delivery mission.
// ---------------------------------------------------------------------------

export function buildRosaDialogue(hooks: {
  onOpenShop: () => void;
  onStartDelivery: () => void;
  deliveryAvailable: () => boolean;
  deliveryDone: () => boolean;
}): DialogueTree {
  return {
    start: "rosa1",
    nodes: {
      rosa1: {
        id: "rosa1",
        lines: [{ speaker: "Mia", text: "FoodMart днём продаёт хлопья, вечером — слухи, деки и кассеты из-под прилавка." }],
        onEnter: () => {
          /* choices are built statically; availability is filtered at build time by caller */
        },
        choices: [
          { text: "Покажи, что под прилавком.", onPick: hooks.onOpenShop },
          {
            text: "Есть подработка?",
            next: "delivery",
          },
          { text: "Я просто посмотреть. (уйти)" },
        ],
      },
      delivery: {
        id: "delivery",
        lines: [
          { speaker: "Mia", text: "Вообще-то да. Данте у мемориала ждёт микстейп для afterparty." },
          { speaker: "Mia", text: "45 секунд. Не разложись по асфальту — коробка с дисками хрупкая, как школьная репутация." },
        ],
        choices: [
          { text: "Время пошло. (взять свёрток)", onPick: hooks.onStartDelivery },
          { text: "Не сейчас." },
        ],
      },
      deliveryBusy: {
        id: "deliveryBusy",
        lines: [{ speaker: "Mia", text: "Микстейп сам себя до парка не довезёт. Беги!" }],
      },
      deliveryDone: {
        id: "deliveryDone",
        lines: [{ speaker: "Mia", text: "Данте получил диски, тусовка спасена. Заглядывай за железом." }],
        choices: [
          { text: "Показывай товар.", onPick: hooks.onOpenShop },
          { text: "До встречи." },
        ],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Dante — film-club kid collecting camcorder tapes around the block.
// ---------------------------------------------------------------------------

export function buildOtisDialogue(hooks: {
  onStartVhs: () => void;
  vhsCount: () => number;
  onTurnIn: () => void;
}): DialogueTree {
  return {
    start: "otis1",
    nodes: {
      otis1: {
        id: "otis1",
        lines: [
          { speaker: "Dante", text: "Я снимаю Homecoming Jam на miniDV, но три кассеты с интро растащили по району." },
          { speaker: "Dante", text: "Одна на крыше FoodMart, одна у мемориала, одна в back alley. Без них фильм будет как трейлер без музыки." },
        ],
        choices: [
          { text: "Найду кассеты для фильма.", onPick: hooks.onStartVhs },
          { text: "Монтаж подождёт. (уйти)" },
        ],
      },
      otisProgress: {
        id: "otisProgress",
        lines: [{ speaker: "Dante", text: "Ищи места, куда обычные ребята не полезут: крыша, памятник, alley." }],
      },
      otisTurnIn: {
        id: "otisTurnIn",
        lines: [
          { speaker: "Dante", text: "Все три! Да, это оно: grain, lens flare, bad decisions. Идеально." },
          { speaker: "Dante", text: "Держи. И скажи Tyler: у тебя теперь есть opening credits." },
        ],
        onEnter: hooks.onTurnIn,
      },
    },
  };
}
