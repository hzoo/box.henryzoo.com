export {};

type MapCoordinates = `${number},${number}`;

type Coord = {
  x: number;
  y: number;
};

type Box = Coord & {
  value: number;
  updated?: boolean; // already operated on in loop
};

type Operator = Box & {
  operator: string;
  outputLocations: Coord[];
  applyOperation?: (box: Box) => any;
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

const canvas = document.querySelector("#paper") as HTMLCanvasElement;
let ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
let GRID_SIZE = 50;
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.font = `${GRID_SIZE / 4}px Arial`;

// coordinate areas contain boxes and potential operator
let areas: Map<MapCoordinates, Area> = new Map();
// @ts-ignore
window.areas = areas;

// on left click (existing or new)
let selectedEntity: Selection | undefined = undefined;
// on right click
let inspectedEntity: Operator | undefined = undefined;
// where the preview box would be placed if dropped on mouseup, snapped to grid
let previewCoordinate: Coord | undefined = undefined;
let offset: Coord = {
  x: 0,
  y: 0,
};

function _isEmptyArea(area: Area): boolean {
  return area.boxes.length === 0 && area.operatorBox === undefined;
}

function isAreaEmpty(key: MapCoordinates): boolean {
  return !areas.has(key) || _isEmptyArea(areas.get(key) as Area);
}

// This function returns the closest grid point to the point (x, y).
// The grid is composed of squares of size GRID_SIZE. The returned grid
// point is the highest point in the grid that is less than or equal
// to (x, y).
function getClosestGrid(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round((x - GRID_SIZE / 2) / GRID_SIZE) * GRID_SIZE,
    y: Math.round((y - GRID_SIZE / 2) / GRID_SIZE) * GRID_SIZE,
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
  for (var x = 0; x < canvas.width; x += GRID_SIZE) {
    for (var y = 0; y < canvas.height; y += GRID_SIZE) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // preview box (where it would be placed if dropped on mouseup)
  if (previewCoordinate) {
    ctx.fillStyle = "#F1F5F9";
    ctx.fillRect(
      previewCoordinate.x,
      previewCoordinate.y,
      GRID_SIZE,
      GRID_SIZE
    );

    // debug
    // ctx.fillStyle = "black";
    // ctx.fillText(
    //   `${previewCoordinate.x},${previewCoordinate.y}`,
    //   previewCoordinate.x + GRID_SIZE / 2,
    //   previewCoordinate.y + GRID_SIZE / 2
    // );
  }

  // draw operator line
  if (
    selectedEntity &&
    selectedEntity.new &&
    selectedEntity?.operator &&
    previewCoordinate
  ) {
    ctx.beginPath();

    let start = {
      x: selectedEntity.startX + GRID_SIZE / 2,
      y: selectedEntity.startY + GRID_SIZE / 2,
    };
    let end = {
      x: previewCoordinate.x + GRID_SIZE / 2,
      y: previewCoordinate.y + GRID_SIZE / 2,
    };

    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  for (let area of areas.values()) {
    let { operatorBox, boxes } = area;
    ctx.strokeStyle = "black";

    // draw each operator
    if (operatorBox) {
      drawBorder(operatorBox.x, operatorBox.y, GRID_SIZE, true);

      // draw operator
      if (operatorBox.applyOperation) {
        ctx.fillText(
          `${operatorBox.operator}`,
          operatorBox.x + GRID_SIZE / 2,
          operatorBox.y + GRID_SIZE + 20
        );
      } else {
        ctx.fillText(
          `${operatorBox.operator}${operatorBox.value}`,
          operatorBox.x + GRID_SIZE / 2,
          operatorBox.y + GRID_SIZE + 20
        );
      }

      // @dev draw line out of box moved to animateLine()
    }

    // draw each box
    for (let box of boxes) {
      // drawBorder(box.x, box.y, GRID_SIZE);
      if (operatorBox && !box.updated) {
        // change box value
        if (box.x == operatorBox.x && box.y == operatorBox.y) {
          // if applyOperation is true, apply the operation to the box
          if (operatorBox.applyOperation) {
            box.value = operatorBox.applyOperation(box);
          } else {
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
        }

        // animate the box towards the end of the operator box
        let end = {
          x: operatorBox.outputLocations[0].x,
          y: operatorBox.outputLocations[0].y,
        };

        box.x += (end.x - box.x) * 0.05;
        box.y += (end.y - box.y) * 0.05;

        // account for negative differnces using math.abs
        if (
          (Math.abs(end.x - box.x) < 1 && box.x !== end.x) ||
          (Math.abs(end.y - box.y) < 1 && box.y !== end.y)
        ) {
          box.updated = true;
          box.x = end.x;
          box.y = end.y;

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
      } else {
        box.updated = false;
      }

      drawBorder(box.x, box.y, GRID_SIZE);

      // value
      let text = box.value.toString();
      // var textWidth = ctx.measureText(text).width;
      ctx.fillText(
        text,
        // box.x + GRID_SIZE / 2 - textWidth / 2,
        box.x + GRID_SIZE / 2,
        box.y + GRID_SIZE / 2
      );
    }

    if (boxes.length > 1) {
      ctx.beginPath();
      ctx.arc(
        boxes[0].x + GRID_SIZE + 7,
        boxes[0].y + GRID_SIZE + 8,
        9,
        0,
        2 * Math.PI
      );
      ctx.strokeStyle = "#f87171";
      ctx.stroke();
      ctx.fillText(
        `${boxes.length}`,
        boxes[0].x + GRID_SIZE + 7,
        boxes[0].y + GRID_SIZE + 9
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

// function to check closest box Coordinate
function getClosestArea(x: number, y: number): Area | undefined {
  let { x: closestX, y: closestY } = getClosestGrid(x, y);
  let key: MapCoordinates = `${closestX},${closestY}`;
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

          let coord: MapCoordinates = `${inspectedEntity.x},${inspectedEntity.y}`;
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
function handleMousedown(event: MouseEvent): void {
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
      offset.x = x - selectedEntity.x - GRID_SIZE / 2;
      offset.y = y - selectedEntity.y - GRID_SIZE / 2;
    }
    return;
  } else {
    // new area
    let newEntity;

    if (event.shiftKey) {
      newEntity = createOperator({
        x: x - GRID_SIZE / 2,
        y: y - GRID_SIZE / 2,
      });
    } else {
      newEntity = createBox({
        x: x - GRID_SIZE / 2,
        y: y - GRID_SIZE / 2,
      });
    }

    let key: MapCoordinates = `${newEntity.x},${newEntity.y}`;
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
}

function createBox({
  x,
  y,
  value,
}: {
  x: number;
  y: number;
  value?: number;
}): Box {
  let newBox: Box = { x, y, value: value || 1 };
  newBox.x = Math.round(newBox.x / GRID_SIZE) * GRID_SIZE;
  newBox.y = Math.round(newBox.y / GRID_SIZE) * GRID_SIZE;

  return newBox;
}

function createOperator({
  x,
  y,
  value,
  applyOperation,
}: {
  x: number;
  y: number;
  value?: number;
  applyOperation?: (box: Box) => any;
}): Operator {
  let newOperator: Operator = createBox({ x, y }) as Operator;
  newOperator.value = value || 1;

  if (applyOperation) {
    newOperator.applyOperation = applyOperation;
    newOperator.operator = applyOperation.name;
    // newOperator.operator = applyOperation.toString();
  } else {
    newOperator.operator = "+";
  }

  newOperator.outputLocations = [
    {
      x: newOperator.x + GRID_SIZE,
      y: newOperator.y,
    },
  ];

  return newOperator;
}

function handleDrag(event: MouseEvent): void {
  if (!selectedEntity) {
    return;
  }

  let { x, y } = getMousePos(canvas, event);
  selectedEntity.x = x - offset.x - GRID_SIZE / 2;
  selectedEntity.y = y - offset.y - GRID_SIZE / 2;

  // set closest grid as "preview"
  // only when creating new operators
  // or when moving existing boxes
  if ((selectedEntity.new && selectedEntity.operator) || !selectedEntity.new) {
    previewCoordinate = getClosestGrid(x, y);
  }

  draw();
}

function handleDrop(event: MouseEvent): void {
  if (!selectedEntity) {
    return;
  }

  let oldCoord: MapCoordinates = `${selectedEntity.startX},${selectedEntity.startY}`;
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
    let key: MapCoordinates = `${x},${y}`;

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
  } else if (selectedEntity.new) {
    if (oldArea?.operatorBox) {
      // set output location of operator to mouse area coord
      oldArea.operatorBox.outputLocations = [previewCoordinate!];
    }
  }

  draw();
  previewCoordinate = undefined;
  selectedEntity = undefined;
}

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
      if (selectedEntity) {
        if (
          operatorBox &&
          operatorBox.x === selectedEntity.startX &&
          operatorBox.y === selectedEntity.startY
        ) {
          continue;
        }
      }

      if (operatorBox) {
        //  draw lines to output locations
        if (operatorBox.outputLocations) {
          for (let outputLocation of operatorBox.outputLocations) {
            let dotCount = Math.floor(
              Math.sqrt(
                Math.pow(outputLocation.x - operatorBox.x, 2) +
                  Math.pow(outputLocation.y - operatorBox.y, 2)
              ) /
                (dotSize + dotSpacing)
            );

            let start = {
              x: operatorBox.x + GRID_SIZE / 2,
              y: operatorBox.y + GRID_SIZE / 2,
            };
            let end = {
              x: outputLocation.x + GRID_SIZE / 2,
              y: outputLocation.y + GRID_SIZE / 2,
            };

            ctx.beginPath();
            ctx.setLineDash([dotSize, dotSpacing]);
            ctx.lineDashOffset = -Math.round(
              progress * (dotSize + dotSpacing) * dotCount
            );
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            // different color for moving line, so it's easier to see
            // not too bright green
            ctx.strokeStyle = "#78350f";
            ctx.stroke();
          }
        }
      }
    }

    requestAnimationFrame(animateLine);
  }
  requestAnimationFrame(animateLine);
}

// add a new box to an area coordinate
// @dev round x and y to closest grid
function addBoxToArea({
  x,
  y,
  value,
}: {
  x: number;
  y: number;
  value?: number;
}) {
  let area = getClosestArea(x, y);
  if (area) {
    area.boxes.push(createBox({ x, y, value }));
  } else {
    areas.set(`${x},${y}`, {
      boxes: [createBox({ x, y, value })],
    });
  }
}

// add an operator to an area coordinate
// @dev round x and y to closest grid
function addOperatorToArea({
  x,
  y,
  value,
  applyOperation,
}: {
  x: number;
  y: number;
  value?: number;
  applyOperation?: (box: Box) => any;
}) {
  let area = getClosestArea(x, y);
  if (area) {
    area.operatorBox = createOperator({ x, y, value, applyOperation });
  } else {
    areas.set(`${x},${y}`, {
      boxes: [],
      operatorBox: createOperator({ x, y, value, applyOperation }),
    });
  }
}

let double = (b: Box) => b.value * 2;

function init() {
  canvas.addEventListener("mousedown", handleMousedown);
  canvas.addEventListener("mousemove", handleDrag);
  canvas.addEventListener("mouseup", handleDrop);

  // clear all boxes on press c
  document.addEventListener("keydown", function (event) {
    if (event.key === "c") {
      areas.clear();
      draw();
    } else if (event.key === "Escape") {
      hideContextMenu();
    }
  });

  addBoxToArea({ x: 0, y: 0 });
  addOperatorToArea({ x: 50, y: 50 });
  addOperatorToArea({ x: 100, y: 100, value: 2 });
  addOperatorToArea({ x: 150, y: 150, value: 4 });
  addOperatorToArea({
    x: 200,
    y: 200,
    applyOperation: double,
  });
  addBoxToArea({ x: 0, y: 200, value: 10000 });
  addBoxToArea({ x: 50, y: 200, value: 100 });
  addBoxToArea({ x: 100, y: 200, value: 1000 });

  animateBoxLines();
  requestAnimationFrame(draw);
}

init();
