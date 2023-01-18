export {};

type Coordinates = `${number},${number}`;

type Coord = {
  x: number;
  y: number;
};

type Box = Coord & {
  value: number;
};

type Operator = Box & {
  operator: string;
  boxLength: number;
  applyOperation?: (box: Box) => void;
};

type Area = {
  operatorBox?: Operator;
  boxes: Box[];
};

type Selection = Operator & {
  new?: boolean;
  startX: number;
  startY: number;
};

function isOperator(entity: Box | Operator): entity is Operator {
  return (entity as Operator).operator !== undefined;
}

function _isEmptyArea(area: Area): boolean {
  return area.boxes.length === 0 && area.operatorBox === undefined;
}

function isAreaEmpty(key: Coordinates): boolean {
  return !areas.has(key) || _isEmptyArea(areas.get(key) as Area);
}

const canvas = document.querySelector("#paper") as HTMLCanvasElement;
let ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
let boxSize = 50;
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.font = `${boxSize / 4}px Arial`;

// coordinate areas contain boxes and potential operator
let areas: Map<Coordinates, Area> = new Map();
// @ts-ignore
window.areas = areas;

// if dragging
let selectedEntity: Selection | undefined = undefined;
let inspectedEntity: Operator | undefined = undefined;
let previewCoordinate: Coord | undefined = undefined;
let offset: Coord = {
  x: 0,
  y: 0,
};

// This function returns the closest grid point to the point (x, y).
// The grid is composed of squares of size boxSize. The returned grid
// point is the highest point in the grid that is less than or equal
// to (x, y).
function getClosestGrid(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round((x - boxSize / 2) / boxSize) * boxSize,
    y: Math.round((y - boxSize / 2) / boxSize) * boxSize,
  };
}

function drawBorder(x: number, y: number, size: number, dotted = false) {
  ctx.fillStyle = "black";
  ctx.lineDashOffset = 0;
  if (dotted) {
    ctx.setLineDash([5, 5]);
  } else {
    ctx.setLineDash([]);
  }
  ctx.strokeRect(x, y, size, size);
  // ctx.beginPath();
  // @ts-ignore
  // ctx.roundRect(x, y, size, size, 10);
  // ctx.stroke();
}

function draw() {
  // clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "black";

  // grid dots
  for (var x = 0; x < canvas.width; x += boxSize) {
    for (var y = 0; y < canvas.height; y += boxSize) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // preview box (where it would be placed if dropped on mouseup)
  if (previewCoordinate) {
    ctx.fillStyle = "#F1F5F9";
    ctx.fillRect(previewCoordinate.x, previewCoordinate.y, boxSize, boxSize);

    // debug
    // ctx.fillStyle = "black";
    // ctx.fillText(
    //   `${previewCoordinate.x},${previewCoordinate.y}`,
    //   previewCoordinate.x + boxSize / 2,
    //   previewCoordinate.y + boxSize / 2
    // );
  }

  // draw line from selected box to nearest box (if dragging)
  if (selectedEntity && selectedEntity.new && selectedEntity?.operator) {
    ctx.beginPath();
    ctx.moveTo(
      selectedEntity.startX + boxSize,
      selectedEntity.startY + boxSize / 2
    );
    // lineTo nearest dot/box
    let { x, y } = getClosestGrid(selectedEntity.x, selectedEntity.y);
    ctx.lineTo(x, y + boxSize / 2);
    ctx.stroke();
  }

  for (let area of areas.values()) {
    let { operatorBox, boxes } = area;
    ctx.strokeStyle = "black";

    // draw each operator
    if (operatorBox) {
      drawBorder(operatorBox.x, operatorBox.y, boxSize, true);

      // draw operator
      ctx.fillText(
        `${operatorBox.operator}${operatorBox.value}`,
        operatorBox.x + boxSize / 2,
        operatorBox.y + boxSize + 20
      );

      // @dev draw line out of box moved to animateLine()
    }

    // draw each box
    for (let box of boxes) {
      // drawBorder(box.x, box.y, boxSize);
      if (operatorBox) {
        // change box value
        if (box.x == operatorBox.x) {
          let operator = operatorBox.operator;
          let operatorValue = operatorBox.value;
          let boxValue = box.value;

          if (operator === "+") {
            box.value = operatorValue + boxValue;
          } else if (operator === "-") {
            box.value = operatorValue - boxValue;
          } else if (operator === "*") {
            box.value = operatorValue * boxValue;
          } else if (operator === "/") {
            box.value = operatorValue / boxValue;
          }
        }

        // animate the box towards the end of the operator box
        let endX = operatorBox.x + (operatorBox.boxLength + 1) * boxSize;
        // let endY = operatorBox.y + (operatorBox.boxLength + 1) * boxSize;

        box.x += (endX - box.x) * 0.05;
        // box.y += (endY - box.y) * 0.05;

        if (box.x + 1 >= endX) {
          // || box.y > endY
          box.x = endX;
          // box.y = endY;

          // remove box from area
          area.boxes = area.boxes.filter((b) => b !== box);

          // add box to new area based on x and y
          let newArea = getClosestArea(box.x, box.y);
          if (newArea) {
            newArea.boxes.push(box);
          } else {
            // create new area
            let newArea: Area = {
              boxes: [box],
              operatorBox: undefined,
            };
            areas.set(`${box.x},${box.y}`, newArea);
          }
        }
      }
      drawBorder(box.x, box.y, boxSize);

      // value
      let text = box.value.toString();
      var textWidth = ctx.measureText(text).width;
      ctx.fillText(
        text,
        box.x + boxSize / 2 - textWidth / 2,
        box.y + boxSize / 2
      );
    }

    if (boxes.length > 1) {
      ctx.beginPath();
      ctx.arc(
        boxes[0].x + boxSize + 7,
        boxes[0].y + boxSize + 8,
        9,
        0,
        2 * Math.PI
      );
      ctx.strokeStyle = "#f87171";
      ctx.stroke();
      ctx.fillText(
        `${boxes.length}`,
        boxes[0].x + boxSize + 7,
        boxes[0].y + boxSize + 9
      );
    }
  }
}

// get mouse position
function getMousePos(canvas: HTMLCanvasElement, event: MouseEvent) {
  var rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

// function to check closest box to mouse
function getClosestArea(x: number, y: number): Area | undefined {
  let { x: closestX, y: closestY } = getClosestGrid(x, y);
  let key: Coordinates = `${closestX},${closestY}`;
  if (areas.has(key)) {
    return areas.get(key);
  }

  return undefined;
}

function createContextMenu() {
  // menu needs to show up over the canvas correctly
  let contextMenu = document.createElement("div");
  contextMenu.classList.add("context-menu");

  contextMenu.innerHTML = `
      <div class="context-menu-item" data-action="delete">Delete</div>
    `;
  contextMenu.style.position = "absolute";
  // menu should have a border and padding
  contextMenu.style.padding = "10px";
  contextMenu.style.border = "1px solid black";
  contextMenu.style.backgroundColor = "white";

  // add event listener to menu items
  contextMenu.addEventListener("click", function (event: Event) {
    let action = (event.target as HTMLInputElement).getAttribute("data-action");
    if (action === "delete") {
      if (inspectedEntity) {
        let area = getClosestArea(inspectedEntity.x, inspectedEntity.y);
        if (area) {
          if (inspectedEntity.operator) {
            area.operatorBox = undefined;
          } else {
            area.boxes = area.boxes.filter(
              (box) => box !== inspectedEntity
            ) as Selection[];
          }

          let coord: Coordinates = `${inspectedEntity.x},${inspectedEntity.y}`;
          if (isAreaEmpty(coord)) {
            areas.delete(coord);
          }
        }
      }
    }
    inspectedEntity = undefined;
    hideContextMenu();
  });

  document.body.appendChild(contextMenu);
  return contextMenu;
}

function hideContextMenu() {
  let contextMenu = document.querySelector(".context-menu") as HTMLDivElement;
  if (contextMenu) {
    contextMenu.style.display = "none";
  }
}

canvas.addEventListener("contextmenu", function (event) {
  // Prevent the default context menu from appearing
  event.preventDefault();

  // Get the mouse position
  let { x, y } = getMousePos(canvas, event);
  let area = getClosestArea(x, y);

  // existing area
  if (area) {
    if (area.boxes.length > 0) {
      // select last box
      inspectedEntity = area.boxes[area.boxes.length - 1] as Selection;
    } else if (area.operatorBox) {
      // select operator
      inspectedEntity = area.operatorBox as Selection;
    }

    // create context menu
    // check if menu already exists in dom with class context-menu
    let contextMenu = document.querySelector(".context-menu") as HTMLDivElement;

    if (!contextMenu) {
      contextMenu = createContextMenu();
    }

    contextMenu.style.display = "block";
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
  }
});

// box selection or new box
canvas.addEventListener("mousedown", function (event) {
  // only left click
  if (event.button !== 0) {
    return;
  }

  let contextMenu = document.querySelector(".context-menu") as HTMLDivElement;
  if (contextMenu && contextMenu.style.display !== "none") {
    hideContextMenu();
    return;
  }

  let { x, y } = getMousePos(canvas, event);
  let area = getClosestArea(x, y);

  // existing area
  if (area) {
    if (area.boxes.length > 0) {
      // select last box
      selectedEntity = area.boxes[area.boxes.length - 1] as Selection;
    } else if (area.operatorBox) {
      // select operator
      selectedEntity = area.operatorBox as Selection;
    } else {
      return;
    }

    selectedEntity.startX = selectedEntity.x;
    selectedEntity.startY = selectedEntity.y;
    if (selectedEntity) {
      offset.x = x - selectedEntity.x - boxSize / 2;
      offset.y = y - selectedEntity.y - boxSize / 2;
    }
    return;
  } else {
    // new area
    let newEntity;

    if (event.shiftKey) {
      newEntity = createOperator({
        x: x - boxSize / 2,
        y: y - boxSize / 2,
      });
    } else {
      newEntity = createBox({
        x: x - boxSize / 2,
        y: y - boxSize / 2,
      });
    }

    let key: Coordinates = `${newEntity.x},${newEntity.y}`;
    if (isOperator(newEntity)) {
      areas.set(key, {
        operatorBox: newEntity,
        boxes: [],
      });
    } else {
      areas.set(key, {
        operatorBox: undefined,
        boxes: [newEntity],
      });
    }

    selectedEntity = {
      ...newEntity,
      startX: newEntity.x,
      startY: newEntity.y,
      new: true,
    } as Selection;

    offset.x = 0;
    offset.y = 0;

    draw();
  }
});

function createBox({ x, y }: { x: number; y: number }): Box {
  let newBox: Box = { x, y, value: 1 };
  newBox.x = Math.round(newBox.x / boxSize) * boxSize;
  newBox.y = Math.round(newBox.y / boxSize) * boxSize;

  return newBox;
}

function createOperator({
  x,
  y,
  boxLength,
  value,
}: {
  x: number;
  y: number;
  boxLength?: number;
  value?: number;
}): Operator {
  let newOperator: Operator = createBox({ x, y }) as Operator;
  newOperator.value = value || 1;
  newOperator.operator = "+";
  newOperator.boxLength = boxLength || 0;

  return newOperator;
}

canvas.addEventListener("mousemove", function (event) {
  if (!selectedEntity) {
    return;
  }

  let { x, y } = getMousePos(canvas, event);
  selectedEntity.x = x - offset.x - boxSize / 2;
  selectedEntity.y = y - offset.y - boxSize / 2;

  let closest = getClosestGrid(x, y);

  // when moving existing boxes around
  if (!selectedEntity.new) {
    // set closest grid as "preview"
    previewCoordinate = closest;
  }

  draw();
});

// dropping
canvas.addEventListener("mouseup", function (event) {
  if (!selectedEntity) {
    return;
  }

  let oldCoord: Coordinates = `${selectedEntity.startX},${selectedEntity.startY}`;
  let oldArea = areas.get(oldCoord)!;

  // when moving existing boxes around
  if (!selectedEntity.new && previewCoordinate) {
    if (oldArea) {
      // delete old box
      if (isOperator(selectedEntity)) {
        oldArea!.operatorBox = undefined;
      } else if (oldArea.boxes) {
        oldArea.boxes = oldArea.boxes.filter((box) => box !== selectedEntity);
      }
    }

    let x = previewCoordinate.x;
    let y = previewCoordinate.y;
    let key: Coordinates = `${x},${y}`;

    // if new area
    if (isAreaEmpty(key)) {
      if (isOperator(selectedEntity)) {
        areas.set(key, {
          operatorBox: { ...selectedEntity, x, y },
          boxes: [],
        });
      } else {
        selectedEntity;
        areas.set(key, {
          operatorBox: undefined,
          boxes: [{ ...(selectedEntity as Box), x, y }],
        });
      }
    } else {
      // if existing area

      if (isOperator(selectedEntity)) {
        // if area already has operator
        if (areas.get(key)!.operatorBox) {
          // add operator to old area
          areas.get(oldCoord)!.operatorBox = {
            ...selectedEntity,
            x: selectedEntity.startX,
            y: selectedEntity.startY,
          };
        } else {
          // add operator to existing area
          areas.get(key)!.operatorBox = {
            ...selectedEntity,
            x,
            y,
          };
        }
      } else {
        // get new area based on key
        let area = areas.get(key)!;

        // add box to existing area
        let selectedBox = selectedEntity as Box;
        area.boxes.push({ ...selectedBox, x, y });
      }
    }

    // delete area if empty
    if (isAreaEmpty(oldCoord)) {
      areas.delete(oldCoord);
    }
    previewCoordinate = undefined;
  } else if (selectedEntity.new) {
    // set rounded boxLength if new operator
    if (oldArea?.operatorBox) {
      oldArea.operatorBox.boxLength = Math.round(
        Math.sqrt(
          Math.pow(selectedEntity.x - selectedEntity.startX, 2) +
            Math.pow(selectedEntity.y - selectedEntity.startY, 2)
        ) / boxSize
      );
    }
  }

  draw();
  selectedEntity = undefined;
});

// clear all boxes on press c
document.addEventListener("keydown", function (event) {
  if (event.key === "c") {
    areas.clear();
    draw();
  } else if (event.key === "Escape") {
    hideContextMenu();
  }
});

function animateBoxLines() {
  let dotSpacing = 10;
  let dotSize = 5;
  let animationDuration = 4000;
  let startTime = performance.now();
  function animateLine() {
    draw();
    let time = performance.now();
    let progress = (time - startTime) / animationDuration;
    if (progress > 1) {
      progress = 1;
      startTime = performance.now();
    }

    for (let { operatorBox } of areas.values()) {
      if (operatorBox) {
        // draw line as long as boxLength
        if (operatorBox.boxLength && operatorBox.boxLength > 0) {
          let dotCount = Math.floor(
            (operatorBox.boxLength * boxSize) / (dotSize + dotSpacing)
          );

          ctx.beginPath();
          ctx.setLineDash([dotSize, dotSpacing]);
          ctx.lineDashOffset = -Math.round(
            progress * (dotSize + dotSpacing) * dotCount
          );
          // ctx.moveTo(start.x, start.y);
          // ctx.lineTo(end.x, end.y);
          ctx.moveTo(operatorBox.x + boxSize, operatorBox.y + boxSize / 2);
          ctx.lineTo(
            operatorBox.x + boxSize + operatorBox.boxLength * boxSize,
            operatorBox.y + boxSize / 2
          );
          // different color for moving line, so it's easier to see
          // not too bright green
          ctx.strokeStyle = "#78350f";
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animateLine);
  }
  requestAnimationFrame(animateLine);
}

// add a new box to an area coordinate
// @dev round x and y to closest grid
function addBoxToArea({ x, y }: { x: number; y: number }) {
  let area = getClosestArea(x, y);
  if (area) {
    area.boxes.push(createBox({ x, y }));
  } else {
    areas.set(`${x},${y}`, {
      boxes: [createBox({ x, y })],
    });
  }
}

// add an operator to an area coordinate
// @dev round x and y to closest grid
function addOperatorToArea({
  x,
  y,
  boxLength = 1,
  value,
}: {
  x: number;
  y: number;
  boxLength?: number;
  value?: number;
}) {
  let area = getClosestArea(x, y);
  if (area) {
    area.operatorBox = createOperator({ x, y, boxLength, value });
  } else {
    areas.set(`${x},${y}`, {
      boxes: [],
      operatorBox: createOperator({ x, y, boxLength, value }),
    });
  }
}

function init() {
  addBoxToArea({ x: 0, y: 0 });
  addOperatorToArea({ x: 50, y: 50 });
  addOperatorToArea({ x: 100, y: 100, boxLength: 2, value: 2 });
  addOperatorToArea({ x: 150, y: 150, boxLength: 4, value: 4 });
  addBoxToArea({ x: 200, y: 200 });
  addBoxToArea({ x: 200, y: 200 });

  animateBoxLines();
  requestAnimationFrame(draw);
}

init();
