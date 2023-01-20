export {};

type MapCoordinates = `${number},${number}`;

type Coord = {
  x: number;
  y: number;
};

type BoxHistory = {
  value: number;
  operator: string;
};

type Box = Coord & {
  history: BoxHistory[];
  value: number;
  updated?: boolean; // already operated on in loop
  end?: Coord; // where to animate towards
};

type Operator = Box & {
  operator: string; // name
  outputOffsets: Coord[]; // store offset from x,y
  applyOperation: (b: any) => any;
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

const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
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
let inspectedEntity: Operator = {
  x: 0,
  y: 0,
  operator: "",
  outputOffsets: [],
  history: [],
  value: 0,
};
// where the preview box would be placed if dropped on mouseup, snapped to grid
let previewCoordinate: Coord | undefined = undefined;
let offset: Coord = {
  x: 0,
  y: 0,
};
let spacePressed = false;
let pan: Coord = {
  x: 0,
  y: 0,
};
let fixedCanvasLog = "";
let canvasLogs: string[] = [];
let mouse: Coord = {
  x: 0,
  y: 0,
};

function log(text: string) {
  // add new log to array
  canvasLogs.unshift(text);

  // remove oldest log if more than 3
  if (canvasLogs.length > 3) {
    canvasLogs.pop();
  }
}

function logFixed(text: string) {
  fixedCanvasLog = text;
}

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

function strokeRect(x: number, y: number, sizeX: number, sizeY: number) {
  ctx.fillStyle = "black";
  let { x: _x, y: _y } = applyPan(x, y);
  ctx.strokeRect(_x, _y, sizeX, sizeY);
}

function drawBorder(x: number, y: number, size: number, dotted = false) {
  ctx.fillStyle = "black";
  ctx.lineDashOffset = 0;
  if (dotted) {
    ctx.setLineDash([5, 5]);
  } else {
    ctx.setLineDash([]);
  }
  let { x: _x, y: _y } = applyPan(x, y);
  ctx.strokeRect(_x, _y, size, size);
}

function applyPan(x: number, y: number): { x: number; y: number } {
  return { x: x + pan.x, y: y + pan.y };
}

// wrap fn to add pan
function fillRect(x: number, y: number, size: number) {
  let { x: _x, y: _y } = applyPan(x, y);
  ctx.fillRect(_x, _y, size, size);
}

// wrap fn to fill text
function fillText(text: string, x: number, y: number) {
  let { x: _x, y: _y } = applyPan(x, y);
  ctx.fillText(text, _x, _y);
}

function drawLine(startCoord: Coord, endCoord: Coord) {
  let { x: startX, y: startY } = applyPan(startCoord.x, startCoord.y);
  let { x: endX, y: endY } = applyPan(endCoord.x, endCoord.y);
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
}

function draw() {
  // clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "black";

  let startX = -pan.x + (pan.x % GRID_SIZE);
  let startY = -pan.y + (pan.y % GRID_SIZE);
  let endX = startX + canvas.width;
  let endY = startY + canvas.height;
  for (let i = startX; i < endX; i += GRID_SIZE) {
    for (let j = startY; j < endY; j += GRID_SIZE) {
      fillRect(i, j, 2);
    }
  }

  // preview box (where it would be placed if dropped on mouseup)
  if (previewCoordinate) {
    ctx.fillStyle = "#F1F5F9";
    fillRect(previewCoordinate.x, previewCoordinate.y, GRID_SIZE);

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
    drawLine(
      {
        x: selectedEntity.startX + GRID_SIZE / 2,
        y: selectedEntity.startY + GRID_SIZE / 2,
      },
      {
        x: previewCoordinate.x + GRID_SIZE / 2,
        y: previewCoordinate.y + GRID_SIZE / 2,
      }
    );
  }

  for (let area of areas.values()) {
    let { operatorBox, boxes } = area;
    ctx.strokeStyle = "black";

    // draw each operator
    if (operatorBox) {
      drawBorder(operatorBox.x, operatorBox.y, GRID_SIZE, true);

      fillText(
        `${operatorBox.operator}`,
        operatorBox.x + GRID_SIZE / 2,
        operatorBox.y + GRID_SIZE + 20
      );

      // @dev draw line out of box moved to animateLine()
    }

    // draw each box
    for (let box of boxes) {
      // drawBorder(box.x, box.y, GRID_SIZE);
      if (operatorBox && !box.updated) {
        // change box value
        if (box.x == operatorBox.x && box.y == operatorBox.y) {
          // animate the box towards the end of the operator box
          box.end = {
            x: operatorBox.x + operatorBox.outputOffsets[0].x,
            y: operatorBox.y + operatorBox.outputOffsets[0].y,
          };

          let result = operatorBox.applyOperation(box.value);
          if (typeof result === "number") {
            box.value = result;
          } else {
            if (Array.isArray(result)) {
              box.value = result[0];

              // create a new box for each value in the array
              for (let i = 1; i < result.length; i++) {
                let newBox = {
                  x: box.x + 0.1,
                  y: box.y,
                  end: {
                    x: operatorBox.x + operatorBox.outputOffsets[i].x,
                    y: operatorBox.y + operatorBox.outputOffsets[i].y,
                  },
                  value: result[i],
                  history: [
                    {
                      operator: operatorBox.operator,
                      value: operatorBox.value,
                    },
                  ],
                };
                boxes.push(newBox);
              }
            }
          }
          box.history.push({
            operator: operatorBox.operator,
            value: operatorBox.value,
          });
        }

        let end = box.end!;

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

      // change color based on the distance from the operator box
      // where the closest distance is red and the furthest distance is black
      if (operatorBox) {
        let distance = Math.sqrt(
          Math.pow(operatorBox.x - box.x, 2) +
            Math.pow(operatorBox.y - box.y, 2)
        );
        let maxDistance = Math.sqrt(
          Math.pow(operatorBox.outputOffsets[0].x, 2) +
            Math.pow(operatorBox.outputOffsets[0].y, 2)
        );
        let colorValue = Math.max(1 - distance / maxDistance, 0.33);
        let color = `rgba(255, 0, 255, ${colorValue})`;
        ctx.strokeStyle = color;
      } else {
        ctx.strokeStyle = "black";
      }
      ctx.fillStyle = "white";
      fillRect(box.x, box.y, GRID_SIZE);
      ctx.fillStyle = "black";
      drawBorder(box.x, box.y, GRID_SIZE);

      // draw value
      let text = box.value.toString();
      fillText(text, box.x + GRID_SIZE / 2, box.y + GRID_SIZE / 2);
    }

    // draw number of boxes in area in a circle
    // no operator box
    if (!area.operatorBox && boxes.length > 1) {
      ctx.beginPath();
      ctx.arc(
        boxes[0].x + GRID_SIZE + 7 + pan.x,
        boxes[0].y + GRID_SIZE + 8 + pan.y,
        9,
        0,
        2 * Math.PI
      );
      ctx.strokeStyle = "#f87171";
      ctx.stroke();
      fillText(
        `${boxes.length}`,
        boxes[0].x + GRID_SIZE + 7,
        boxes[0].y + GRID_SIZE + 9
      );
    }
  }

  ctx.textAlign = "left";
  // draw logs
  for (let i = 0; i < canvasLogs.length; i++) {
    fillText(canvasLogs[i], mouse.x + 5, mouse.y - 30 - i * 20);

    let textWidth = ctx.measureText(canvasLogs[i]).width;
    strokeRect(
      mouse.x,
      mouse.y - (canvasLogs.length + 1) * 20 - 8,
      textWidth + 10,
      (canvasLogs.length + 1) * 20 + 5
    );
  }
  // fixedCanvasLog;
  if (fixedCanvasLog) {
    fillText(fixedCanvasLog, mouse.x + 5, mouse.y - 12);
  }
  ctx.textAlign = "center";
}

// get mouse position
// handle pan by substracting
function getMousePos(canvas: HTMLCanvasElement, event: MouseEvent) {
  var rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left - pan.x,
    y: event.clientY - rect.top - pan.y,
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

function updateContextMenu(
  action: "existing-box" | "existing-operator" | "new"
) {
  let contextMenu = document.querySelector(".context-menu") as HTMLDivElement;
  if (action === "existing-box") {
    contextMenu.innerHTML = `
      <div class="context-menu-item" data-action="edit">Edit</div>
      <div class="context-menu-item" data-action="delete">Delete</div>
    `;
  } else if (action === "existing-operator") {
    contextMenu.innerHTML = `
      <div class="context-menu-item" data-action="edit">Edit</div>
      <div class="context-menu-item" data-action="edit-name">Edit Name</div>
      <div class="context-menu-item" data-action="delete">Delete</div>
    `;
  } else if (action === "new") {
    contextMenu.innerHTML = `
      <div class="context-menu-item" data-action="create-value">Create Value</div>
      <div class="context-menu-item" data-action="create-operator">Create Operator</div>
    `;
  }
}

function getCoordFromHtmlDivElement(element: HTMLDivElement): Coord {
  let { x, y } = getClosestGrid(
    parseInt(element.style.left),
    parseInt(element.style.top)
  );
  return { x, y };
}

function createInput(property: "operator" | "value") {
  let prop = inspectedEntity[property];
  if (!prop) {
    return;
  }

  // create input element
  let input = document.createElement("input");
  if (property == "value") {
    input.type = "number";
  } else {
    input.type = "text";
  }
  input.value = prop.toString();
  input.style.position = "absolute";
  input.style.left = `${inspectedEntity.x}px`;
  input.style.top = `${inspectedEntity.y}px`;
  input.style.width = `${GRID_SIZE}px`;
  input.style.height = `${GRID_SIZE}px`;

  document.body.appendChild(input);
  input.focus();

  input.addEventListener("keydown", function (event: KeyboardEvent) {
    if (event.key === "Enter") {
      let val = (event.target as HTMLInputElement).value;
      if (property == "value") {
        inspectedEntity[property] = parseInt(val);
      } else {
        inspectedEntity[property] = val;
      }

      input.remove();
    }
  });

  input.addEventListener("blur", function (event: Event) {
    let val = (event.target as HTMLInputElement).value;
    if (property == "value") {
      inspectedEntity[property] = parseInt(val);
    } else {
      inspectedEntity[property] = val;
    }

    input.remove();
  });
}

function createContextMenu() {
  // menu needs to show up over the canvas correctly
  let contextMenu = document.createElement("div");
  contextMenu.classList.add("context-menu");

  // contextMenu.innerHTML = `
  //     <div class="context-menu-item" data-action="delete">Delete</div>
  //   `;
  contextMenu.style.position = "absolute";
  contextMenu.style.border = "1px solid black";
  contextMenu.style.backgroundColor = "white";

  // add event listener to menu items
  contextMenu.addEventListener("click", function (event: Event) {
    let action = (event.target as HTMLInputElement).getAttribute("data-action");
    let contextMenuCoord = getCoordFromHtmlDivElement(contextMenu);

    switch (action) {
      case "edit-name":
        createInput("operator");
        break;
      case "edit":
        if (inspectedEntity.operator) {
          // create input element
          let input = document.createElement("textarea");
          input.style.position = "absolute";
          input.style.left = `${inspectedEntity.x}px`;
          input.style.top = `${inspectedEntity.y}px`;
          input.style.width = `${GRID_SIZE * 3}px`;
          input.style.height = `${GRID_SIZE}px`;
          input.value = inspectedEntity.applyOperation.toString();
          document.body.appendChild(input);
          input.focus();

          function handleChange(event: Event) {
            let inputValue = (event.target as HTMLInputElement).value;
            try {
              let fn = new Function(`return ${inputValue}`);
              let opFn = fn();
              inspectedEntity.applyOperation = opFn;
              let res = opFn(1);
              if (Array.isArray(res)) {
                if (res.length > inspectedEntity.outputOffsets.length) {
                  for (
                    let i = inspectedEntity.outputOffsets.length;
                    i < res.length;
                    i++
                  ) {
                    inspectedEntity.outputOffsets.push({
                      x: GRID_SIZE,
                      y: i * GRID_SIZE,
                    });
                  }
                } else if (res.length < inspectedEntity.outputOffsets.length) {
                  inspectedEntity.outputOffsets =
                    inspectedEntity.outputOffsets.slice(0, res.length);
                }
              } else {
                inspectedEntity.outputOffsets =
                  inspectedEntity.outputOffsets.slice(0, 1);
              }
              log(`set ${inspectedEntity.operator} to ${opFn}`);
            } catch (e) {
              log(`error setting ${inspectedEntity.operator} to ${inputValue}`);
            }
            input.remove();
          }

          input.addEventListener("keydown", function (event: KeyboardEvent) {
            if (event.key === "Enter" && !event.shiftKey) {
              handleChange(event);
            }
          });

          input.addEventListener("blur", function (event: Event) {
            handleChange(event);
          });
        } else {
          createInput("value");
        }
        break;
      case "delete":
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
        break;
      case "create-value":
        addBoxToArea(contextMenuCoord);
        break;
      case "create-operator":
        addOperatorToArea(contextMenuCoord);
        break;
    }

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
  let area = getClosestArea(mouse.x, mouse.y);

  // create context menu
  let contextMenu = document.querySelector(".context-menu") as HTMLDivElement;
  if (!contextMenu) {
    contextMenu = createContextMenu();
  }

  contextMenu.style.display = "block";
  contextMenu.style.left = `${mouse.x}px`;
  contextMenu.style.top = `${mouse.y}px`;

  // existing area
  if (area) {
    if (area.boxes.length > 0) {
      // select last box
      inspectedEntity = area.boxes[area.boxes.length - 1] as Selection;
      updateContextMenu("existing-box");
    } else if (area.operatorBox) {
      // select operator
      inspectedEntity = area.operatorBox as Selection;
      updateContextMenu("existing-operator");
    }
  } else {
    updateContextMenu("new");
  }
});

// box selection or new box
function handleMousedown(event: MouseEvent): void {
  // only left click
  if (event.button !== 0 || spacePressed) {
    return;
  }

  let contextMenu = document.querySelector(".context-menu") as HTMLDivElement;
  if (contextMenu && contextMenu.style.display !== "none") {
    hideContextMenu();
    return;
  }

  let area = getClosestArea(mouse.x, mouse.y);

  // existing area
  if (area) {
    if (area.operatorBox) {
      // select operator
      selectedEntity = area.operatorBox as Selection;
    } else if (area.boxes.length > 0) {
      // select last box
      selectedEntity = area.boxes[area.boxes.length - 1] as Selection;
    } else {
      return;
    }

    selectedEntity.startX = selectedEntity.x;
    selectedEntity.startY = selectedEntity.y;
    if (selectedEntity) {
      offset.x = mouse.x - selectedEntity.x - GRID_SIZE / 2;
      offset.y = mouse.y - selectedEntity.y - GRID_SIZE / 2;
    }
  } else {
    // new area
    let newEntity;

    if (event.shiftKey) {
      newEntity = addOperatorToArea({
        x: mouse.x - GRID_SIZE / 2,
        y: mouse.y - GRID_SIZE / 2,
      });
    } else if (event.metaKey) {
      newEntity = addBoxToArea({
        x: mouse.x - GRID_SIZE / 2,
        y: mouse.y - GRID_SIZE / 2,
      });
    } else {
      return;
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
  let newBox: Box = {
    x,
    y,
    value: value || 1,
    history: [
      {
        operator: "init",
        value: value || 1,
      },
    ],
  };
  newBox.x = Math.round(newBox.x / GRID_SIZE) * GRID_SIZE;
  newBox.y = Math.round(newBox.y / GRID_SIZE) * GRID_SIZE;

  return newBox;
}

function createOperator({
  x,
  y,
  name,
  applyOperation,
}: {
  x: number;
  y: number;
  name?: string;
  applyOperation?: (b: any) => any;
}): Operator {
  let newOperator: Operator = createBox({ x, y }) as Operator;
  newOperator.value = 1;
  newOperator.outputOffsets = [
    {
      x: GRID_SIZE,
      y: 0,
    },
  ];

  if (applyOperation) {
    newOperator.applyOperation = applyOperation;
    let res = applyOperation(1);
    if (Array.isArray(res)) {
      // create multiple outputOffets
      for (let i = 1; i < res.length; i++) {
        newOperator.outputOffsets.push({
          x: GRID_SIZE,
          y: i * GRID_SIZE,
        });
      }
    }
    newOperator.operator = name || applyOperation.name;
  } else {
    newOperator.applyOperation = (a) => a;
    Object.defineProperty(newOperator.applyOperation, "name", { value: "id" });
    newOperator.operator = "id";
  }

  return newOperator;
}

function handleDrag(event: MouseEvent): void {
  mouse = getMousePos(canvas, event);
  logFixed(`${mouse.x}, ${mouse.y}`);
  if (!selectedEntity) {
    if (event.buttons === 1 && spacePressed) {
      canvas.style.cursor = "grabbing";
      pan.x += event.movementX;
      pan.y += event.movementY;
      draw();
    }
  } else {
    selectedEntity.x = mouse.x - offset.x - GRID_SIZE / 2;
    selectedEntity.y = mouse.y - offset.y - GRID_SIZE / 2;

    // set closest grid as "preview"
    // only when creating new operators
    // or when moving existing boxes
    if (
      (selectedEntity.new && selectedEntity.operator) ||
      !selectedEntity.new
    ) {
      previewCoordinate = getClosestGrid(mouse.x, mouse.y);
    }
  }

  draw();
}

function handleDrop(event: MouseEvent): void {
  canvas.style.cursor = "default";
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
      selectedEntity.x = x;
      selectedEntity.y = y;

      if (isOperator(selectedEntity)) {
        areas.set(key, {
          operatorBox: selectedEntity,
          boxes: [],
        });
      } else {
        areas.set(key, {
          operatorBox: undefined,
          boxes: [selectedEntity],
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
      oldArea.operatorBox.outputOffsets = [
        {
          x: previewCoordinate!.x - oldArea.operatorBox.x,
          y: previewCoordinate!.y - oldArea.operatorBox.y,
        },
      ];
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
        if (operatorBox.outputOffsets) {
          for (let offset of operatorBox.outputOffsets) {
            let dotCount = Math.floor(
              Math.sqrt(Math.pow(offset.x, 2) + Math.pow(offset.y, 2)) /
                (dotSize + dotSpacing)
            );

            let start = {
              x: operatorBox.x + GRID_SIZE / 2,
              y: operatorBox.y + GRID_SIZE / 2,
            };
            let end = {
              x: operatorBox.x + offset.x + GRID_SIZE / 2,
              y: operatorBox.y + offset.y + GRID_SIZE / 2,
            };

            ctx.setLineDash([dotSize, dotSpacing]);
            ctx.lineDashOffset = -Math.round(
              progress * (dotSize + dotSpacing) * dotCount
            );
            // different color for moving line, so it's easier to see
            ctx.strokeStyle = "#78350f";
            // draw line
            drawLine(start, end);
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
  let box = createBox({ x, y, value });
  let area = getClosestArea(x, y);
  if (area) {
    area.boxes.push(box);
  } else {
    areas.set(`${box.x},${box.y}`, {
      boxes: [box],
    });
  }
  return box;
}

// add an operator to an area coordinate
// @dev round x and y to closest grid
function addOperatorToArea({
  x,
  y,
  name,
  applyOperation,
}: {
  x: number;
  y: number;
  name?: string;
  applyOperation?: (b: any) => any;
}) {
  let operator = createOperator({ x, y, name, applyOperation });
  let area = getClosestArea(x, y);
  if (area) {
    area.operatorBox = operator;
  } else {
    areas.set(`${operator.x},${operator.y}`, {
      boxes: [],
      operatorBox: operator,
    });
  }
  return operator;
}

let double = (b: number) => b * 2;
let clone = (b: number) => [b, b] as [number, number];

function init() {
  canvas.addEventListener("mousedown", handleMousedown);
  canvas.addEventListener("mousemove", handleDrag);
  canvas.addEventListener("mouseup", handleDrop);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      hideContextMenu();
    } else if (event.key === " ") {
      spacePressed = true;
      canvas.style.cursor = "grab";
    }
  });

  document.addEventListener("keyup", function (event) {
    if (event.key === " ") {
      canvas.style.cursor = "default";
      spacePressed = false;
    }
  });

  addBoxToArea({ x: 0, y: 0 });
  addOperatorToArea({ x: 50, y: 50, applyOperation: (b) => b++, name: "+1" });
  addOperatorToArea({
    x: 100,
    y: 100,
    applyOperation: (b) => b + 2,
    name: "+2",
  });
  addOperatorToArea({
    x: 150,
    y: 150,
    applyOperation: (b) => b + 4,
    name: "+4",
  });
  addOperatorToArea({
    x: 200,
    y: 200,
    applyOperation: double,
  });
  addOperatorToArea({
    x: 250,
    y: 200,
    applyOperation: clone,
  });
  addBoxToArea({ x: 200, y: 200, value: 1 });
  addBoxToArea({ x: 0, y: 200, value: 1 });
  addBoxToArea({ x: 50, y: 200, value: 100 });
  addBoxToArea({ x: 100, y: 200, value: 1000 });

  animateBoxLines();
  requestAnimationFrame(draw);
}

init();
