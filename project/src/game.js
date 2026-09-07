// Pure Snake logic - no DOM, fully testable
export const DIRECTIONS = {
  UP: { x: 0, y: -1, key: 'UP' },
  DOWN: { x: 0, y: 1, key: 'DOWN' },
  LEFT: { x: -1, y: 0, key: 'LEFT' },
  RIGHT: { x: 1, y: 0, key: 'RIGHT' },
};

export const OPPOSITE = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

export function isOpposite(dirA, dirB) {
  if (!dirA || !dirB) return false;
  return OPPOSITE[dirA] === dirB;
}

export function nextHead(head, dirKey) {
  const d = DIRECTIONS[dirKey];
  if (!d) throw new Error(`Invalid direction ${dirKey}`);
  return { x: head.x + d.x, y: head.y + d.y };
}

export function createInitialState(width = 20, height = 20) {
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const snake = [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
  return {
    width,
    height,
    snake,
    direction: 'RIGHT',
    nextDirection: 'RIGHT',
    food: null,
    score: 0,
    gameOver: false,
    reason: null,
  };
}

export function spawnFood(snake, width, height, rng = Math.random) {
  const occupied = new Set(snake.map(p => `${p.x},${p.y}`));
  const free = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  const idx = Math.floor(rng() * free.length);
  return free[idx];
}

export function setDirection(state, newDir) {
  if (!DIRECTIONS[newDir]) return state;
  // prevent immediate 180 reverse
  if (isOpposite(state.direction, newDir)) return state;
  // also prevent reversing via queued nextDirection? allow only if not opposite to current direction
  // if we have queued nextDirection already not yet applied, also prevent opposite of nextDirection?
  // We'll just set nextDirection if not opposite to direction or nextDirection
  if (isOpposite(state.nextDirection, newDir) && state.nextDirection !== state.direction) {
    // if pending direction is already set differently, still block opposite of current
  }
  return { ...state, nextDirection: newDir };
}

export function step(state) {
  if (state.gameOver) return state;

  const dir = state.nextDirection;
  const head = state.snake[0];
  const newHead = nextHead(head, dir);

  // wall collision
  if (newHead.x < 0 || newHead.x >= state.width || newHead.y < 0 || newHead.y >= state.height) {
    return { ...state, direction: dir, gameOver: true, reason: 'wall' };
  }

  // self collision - check if new head hits body (tail will move unless eating, so exclude tail if not eating)
  const willEat = state.food && newHead.x === state.food.x && newHead.y === state.food.y;
  const bodyToCheck = willEat ? state.snake : state.snake.slice(0, -1);
  const hitSelf = bodyToCheck.some(p => p.x === newHead.x && p.y === newHead.y);
  if (hitSelf) {
    return { ...state, direction: dir, gameOver: true, reason: 'self' };
  }

  let newSnake;
  let newFood = state.food;
  let newScore = state.score;

  if (willEat) {
    newSnake = [newHead, ...state.snake];
    newScore += 10;
    // spawn new food deterministically for tests: try to spawn, if null means board full -> win?
    // else set newFood to spawn
    // Do not auto-spawn inside step if we want to test deterministic; but we will spawn here with Math.random.
    // For testing we allow injecting rng via state._rng? Keep simple: caller handles spawn after step. For now auto with Math.random.
    newFood = spawnFood(newSnake, state.width, state.height);
    // if no free space, game over win? Keep playing but no food
    if (newFood === null) {
      // board filled -> victory
      return {
        ...state,
        snake: newSnake,
        direction: dir,
        nextDirection: dir,
        food: null,
        score: newScore,
        gameOver: true,
        reason: 'win',
      };
    }
  } else {
    newSnake = [newHead, ...state.snake.slice(0, -1)];
  }

  return {
    ...state,
    snake: newSnake,
    direction: dir,
    nextDirection: dir,
    food: newFood,
    score: newScore,
  };
}

export function initGame(width, height, rng = Math.random) {
  const s = createInitialState(width, height);
  const food = spawnFood(s.snake, width, height, rng);
  return { ...s, food };
}
