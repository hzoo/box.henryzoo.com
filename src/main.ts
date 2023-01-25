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
  name: string;
  history: BoxHistory[];
  value: number;
  updated?: boolean; // already operated on in loop
  end?: Coord; // where to animate towards
  skipEval?: boolean; // skip evaluation in loop
  speed?: number; // how fast to animate
};

type Operator = Box & {
  outputOffsets: Coord[]; // store offset from x,y
  fn: (b: any) => any;
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
  return (entity as Operator).fn !== undefined;
}

function isBox(entity: Box | Operator): entity is Box {
  return isOperator(entity) === false;
}

let width = document.body.clientWidth;
let height = document.body.clientHeight || 500;
const canvas = (function () {
  try {
    document.getElementById("canvas")?.remove();
  } catch (e) {
    console.log(e);
  }
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<canvas width="${width}" height="${height}" id="canvas"></canvas>`
  );
  return document.getElementById("canvas") as HTMLCanvasElement;
})();

const observer = new ResizeObserver((_) => {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  draw();
});
observer.observe(canvas);

let ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
let GRID_SIZE = 50;
let drawSpeed = 1;
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
  name: "",
  outputOffsets: [],
  history: [],
  value: 0,
  fn: (b) => b,
};
// where the preview box would be placed if dropped on mouseup, snapped to grid
let previewCoordinate: Coord | undefined = undefined;
let offset: Coord = {
  x: 0,
  y: 0,
};
let spacePressed = false;
let metaPressed = false;
let shiftPressed = false;
let altPressed = false;
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

// wrap ctx.fillRect with pan
function fillRect(x: number, y: number, size: number) {
  let { x: _x, y: _y } = applyPan(x, y);
  ctx.fillRect(_x, _y, size, size);
}

// wrap ctx.fillText with pan
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
  // clear canvas in animation frame
  // ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    isOperator(selectedEntity) &&
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

      // move y position up or down depending on if there is an operator above it
      let y = operatorBox.y - 10;
      let x = operatorBox.x + GRID_SIZE / 2;
      let above = getClosestArea(operatorBox.x, operatorBox.y - GRID_SIZE);
      if (above && above.operatorBox) {
        y = operatorBox.y + GRID_SIZE + 12;

        // if also below, move to the left
        let below = getClosestArea(operatorBox.x, operatorBox.y + GRID_SIZE);
        if (below && below.operatorBox) {
          y = operatorBox.y + GRID_SIZE / 2;
          // use ctx.measureText to get width of text
          let m = ctx.measureText(`${operatorBox.name}`);
          x = operatorBox.x - m.width;
        }
      }

      fillText(`${operatorBox.name}`, x, y);

      // @dev draw line out of box moved to animateLine()
    }

    // draw each box
    for (let box of boxes) {
      // drawBorder(box.x, box.y, GRID_SIZE);
      if (operatorBox && !box.updated) {
        // change box value
        if (box.x == operatorBox.x && box.y == operatorBox.y && !box.skipEval) {
          // animate the box towards the end of the operator box
          box.end = {
            x: operatorBox.x + operatorBox.outputOffsets[0].x,
            y: operatorBox.y + operatorBox.outputOffsets[0].y,
          };

          let result = operatorBox.fn(box.value);

          if (Array.isArray(result)) {
            if (result[0] === undefined) {
              area.boxes = area.boxes.filter((b) => b !== box);
            } else {
              box.value = result[0];
            }

            // create a new box for each value in the array
            for (let i = 1; i < result.length; i++) {
              if (result[i] === undefined) continue;

              let end = {
                x: operatorBox.outputOffsets[0].x,
                y: operatorBox.outputOffsets[0].y + i * GRID_SIZE,
              };

              if (operatorBox.outputOffsets[i]) {
                end.x = operatorBox.outputOffsets[i].x;
                end.y = operatorBox.outputOffsets[i].y;
              }

              let newBox = {
                name: "",
                skipEval: true,
                x: box.x,
                y: box.y,
                end: {
                  x: operatorBox.x + end.x,
                  y: operatorBox.y + end.y,
                },
                value: result[i],
                history: [
                  {
                    operator: operatorBox.name,
                    value: operatorBox.value,
                  },
                ],
              };
              area.boxes.push(newBox);
            }
          } else {
            if (result?.constructor === Object) {
              if (result?.name) box.name = result.name;
              if (result?.value) box.value = result.value;
              if (result?.end) box.end = result.end;
              if (result?.speed) box.speed = result.speed;
            } else {
              box.value = result;
            }
          }

          box.history.push({
            operator: operatorBox.name,
            value: box.value,
          });
        }

        box.skipEval = undefined;
        let end = box.end!;

        // only if not already at the end
        if (box.x !== end.x) {
          box.x += (end.x - box.x) * 0.05 * (box.speed || drawSpeed);
        }
        if (box.y !== end.y) {
          box.y += (end.y - box.y) * 0.05 * (box.speed || drawSpeed);
        }

        // account for negative differnces using math.abs
        if (
          (Math.abs(end.x - box.x) < 1 && box.x !== end.x) ||
          (Math.abs(end.y - box.y) < 1 && box.y !== end.y)
        ) {
          box.updated = true;
          box.speed = undefined;
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

      // draw name if there is one
      if (box.name) {
        fillText(box.name, box.x + GRID_SIZE / 2, box.y - 10);
      }
    }

    // TODO: needs to be drawn over boxes
    // draw number of boxes in area in a circle
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
      <div class="context-menu-item" data-action="edit-name">Edit Name</div>
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

function createInput(property: "name" | "value") {
  let prop = inspectedEntity[property];

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
        if (inspectedEntity.name === "drawSpeed") {
          drawSpeed = parseInt(val);
        }
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
      if (inspectedEntity.name === "drawSpeed") {
        drawSpeed = parseInt(val);
      }
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
        createInput("name");
        break;
      case "edit":
        if (isOperator(inspectedEntity)) {
          // create input element
          let input = document.createElement("textarea");
          input.style.position = "absolute";
          input.style.left = `${inspectedEntity.x}px`;
          input.style.top = `${inspectedEntity.y}px`;
          input.style.width = `${GRID_SIZE * 3}px`;
          input.style.height = `${GRID_SIZE}px`;
          input.value = inspectedEntity.fn.toString();
          document.body.appendChild(input);
          input.focus();

          function handleChange(event: Event) {
            let inputValue = (event.target as HTMLInputElement).value;
            try {
              let fn = new Function(`return ${inputValue}`);
              let opFn = fn();
              inspectedEntity.fn = opFn;
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
              // log(`set ${inspectedEntity.name} to ${opFn}`);
            } catch (e) {
              // log(`error setting ${inspectedEntity.name} to ${inputValue}`);
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
          if (isOperator(inspectedEntity)) {
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
  // if right click or space pressed, return
  if (event.button !== 0 || spacePressed) {
    return;
  }
  // mouse = getMousePos(canvas, event);

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
      console.log(newEntity);
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

    // draw();
  }
}

function handleDrag(event: MouseEvent): void {
  mouse = getMousePos(canvas, event);
  // logFixed(`${mouse.x}, ${mouse.y}`);
  if (!selectedEntity) {
    // if left click and space pressed, pan
    if (event.buttons === 1 && spacePressed) {
      canvas.style.cursor = "grabbing";
      pan.x += event.movementX;
      pan.y += event.movementY;
      // draw();
    } else if (metaPressed) {
      // previewCoordinate = getClosestGrid(mouse.x, mouse.y);
    }
  } else if (altPressed) {
    if (isBox(selectedEntity)) {
      selectedEntity.value += Math.round(event.movementX / 4);
    }
  } else {
    selectedEntity.x = mouse.x - offset.x - GRID_SIZE / 2;
    selectedEntity.y = mouse.y - offset.y - GRID_SIZE / 2;

    // set closest grid as "preview"
    // only when creating new operators
    // or when moving existing boxes
    if (
      (selectedEntity.new && isOperator(selectedEntity)) ||
      !selectedEntity.new
    ) {
      previewCoordinate = getClosestGrid(mouse.x, mouse.y);
    }
    // draw();
  }
}

function handleDrop(event: MouseEvent): void {
  canvas.style.cursor = "default";
  if (!selectedEntity) {
    return;
  }
  // mouse = getMousePos(canvas, event);

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
          // move operator back to old area
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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

    draw();
    requestAnimationFrame(animateLine);
  }
  requestAnimationFrame(animateLine);
}

function createBox({
  x,
  y,
  value,
  name,
}: {
  x: number;
  y: number;
  value?: number;
  name?: string;
}): Box {
  let newBox: Box = {
    name: name || "",
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
  fn,
  outputOffsets,
}: {
  x: number;
  y: number;
  name?: string;
  fn?: (b: any) => any;
  outputOffsets?: { x: number; y: number }[];
}): Operator {
  let newOperator: Operator = createBox({ x, y }) as Operator;
  newOperator.value = 1;
  newOperator.outputOffsets = outputOffsets || [
    {
      x: GRID_SIZE,
      y: 0,
    },
  ];

  if (fn) {
    newOperator.fn = fn;
    let res = fn(1);
    if (Array.isArray(res)) {
      // create multiple outputOffets
      // only if newOperator.outputOffsets is empty
      if (newOperator.outputOffsets.length === 1) {
        for (let i = 1; i < res.length; i++) {
          newOperator.outputOffsets.push({
            x: GRID_SIZE,
            y: i * GRID_SIZE,
          });
        }
      }
    }
    newOperator.name = name || fn.name;
  } else {
    newOperator.fn = (a) => a;
    Object.defineProperty(newOperator.fn, "name", { value: "id" });
    newOperator.name = "id";
  }

  return newOperator;
}

// add a new box to an area coordinate
// @dev round x and y to closest grid
function addBoxToArea({
  x,
  y,
  value,
  name,
}: {
  x: number;
  y: number;
  value?: number;
  name?: string;
}) {
  let box = createBox({ x, y, value, name });
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
  fn,
  outputOffsets,
}: {
  x: number;
  y: number;
  name?: string;
  fn?: (b: any) => any;
  outputOffsets?: { x: number; y: number }[];
}) {
  let operator = createOperator({ x, y, name, fn, outputOffsets });
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
    } else if (event.key === "Meta") {
      if (mouse.x !== 0 && mouse.y !== 0) {
        metaPressed = true;
        previewCoordinate = getClosestGrid(mouse.x, mouse.y);
      }
    } else if (event.key === "Shift") {
      shiftPressed = true;
      canvas.style.cursor = "move";
    } else if (event.key === "Alt") {
      altPressed = true;
      canvas.style.cursor = "ew-resize";
    }
  });

  document.addEventListener("keyup", function (event) {
    if (event.key === " ") {
      canvas.style.cursor = "default";
      spacePressed = false;
    } else if (event.key === "Meta") {
      metaPressed = false;
      previewCoordinate = undefined;
    } else if (event.key === "Shift") {
      canvas.style.cursor = "default";
      shiftPressed = false;
    }
  });

  let x = 0;
  let y = 0;

  addBoxToArea({ x: 500, y: 50, name: "drawSpeed" });

  x = 50;
  y = 100;
  addOperatorToArea({
    x,
    y: y + 100,
    fn: double,
  });
  addOperatorToArea({
    x: x + 50,
    y: y + 100,
    fn: clone,
  });

  x = 50;
  y = 50;
  addBoxToArea({ x, y, value: 1 });
  addBoxToArea({ x, y, value: 2 });
  addOperatorToArea({
    x,
    y,
    name: "even?",
    fn: (b) => (b % 2 === 0 ? [b] : [, b]),
  });

  x = 250;
  y = 50;
  addBoxToArea({ x: 200, y: 50, value: 1 });
  addBoxToArea({ x: 250, y, value: 2 });
  addOperatorToArea({
    x,
    y,
    name: "isEven",
    fn: (b) => b % 2 === 0,
  });
  addOperatorToArea({
    x: x - 50,
    y,
    fn: (b) => b,
    name: "id",
  });

  // x = 400;
  // y = 200;
  // addOperatorToArea({
  //   x,
  //   y,
  //   name: "id",
  //   fn: (b) => b,
  // });
  // addBoxToArea({ x, y, value: 16 });
  // addOperatorToArea({
  //   x: x + 50 * 1,
  //   y: y + 50 * 0,
  //   name: ">>2",
  //   fn: (b) => b >> 2,
  // });
  // addOperatorToArea({
  //   x: x + 50 * 2,
  //   y: y + 50 * 0,
  //   name: "id",
  //   fn: (b) => b,
  //   outputOffsets: [{ x: -50, y: 100 }],
  // });
  // addOperatorToArea({
  //   x: x + 50 * 1,
  //   y: y + 50 * 2,
  //   name: "<<2",
  //   fn: (b) => b << 2,
  //   outputOffsets: [{ x: -50, y: -100 }],
  // });

  // createLineOfBoxes({
  //   x: 50,
  //   y: 500,
  //   count: 5,
  //   value: 4,
  // });
  // createLineOfOperators({
  //   x: 50,
  //   y: 500,
  //   name: ">>2",
  //   fn: (b) => b >> 2,
  //   count: 5,
  //   outputOffsets: [{ x: 0, y: 50 }],
  // });
  // createLineOfOperators({
  //   x: 50,
  //   y: 550,
  //   name: "<<2",
  //   fn: (b) => b << 2,
  //   count: 5,
  //   outputOffsets: [{ x: 0, y: -50 }],
  // });

  x = 50;
  y = 350;
  addOperatorToArea({
    x,
    y,
    name: "%3,%5",
    fn: (a) => (a % 3 == 0 && a % 5 == 0 ? ["FizzBuzz"] : [, a]),
    outputOffsets: [
      { x: 50 * 2, y: 50 * 0 },
      { x: 0, y: 50 * 2 },
    ],
  });
  addOperatorToArea({
    x: x + 50 * 0,
    y: y + 50 * 2,
    name: "%3",
    fn: (a) => (a % 3 == 0 ? ["Fizz"] : [, a]),
    outputOffsets: [
      { x: 50 * 2, y: 0 },
      { x: 0, y: 50 * 2 },
    ],
  });
  addOperatorToArea({
    x: x + 50 * 0,
    y: y + 50 * 4,
    name: "%5",
    fn: (a) => (a % 5 == 0 ? ["Buzz"] : [, a]),
    outputOffsets: [
      { x: 50 * 2, y: 0 },
      { x: 50 * 2, y: 50 * 2 },
    ],
  });
  addOperatorToArea({
    x: x + 50 * 2,
    y,
    name: "id",
    fn: (a) => a,
    outputOffsets: [{ x: 50 * 2, y: 50 * 2 }],
  });
  addOperatorToArea({
    x: x + 50 * 2,
    y: y + 50 * 2,
    name: "id",
    fn: (a) => a,
    outputOffsets: [{ x: 50 * 2, y: 0 }],
  });
  addOperatorToArea({
    x: x + 50 * 2,
    y: y + 50 * 4,
    name: "id",
    fn: (a) => a,
    outputOffsets: [{ x: 50 * 2, y: -50 * 2 }],
  });
  addOperatorToArea({
    x: x + 50 * 2,
    y: y + 50 * 6,
    name: "id",
    fn: (a) => a,
    outputOffsets: [{ x: 50 * 2, y: -50 * 4 }],
  });

  x = 350;
  y = 350;
  addOperatorToArea({
    x,
    y,
    name: "%3,%5",
    fn: (a) => (a % 3 == 0 && a % 5 == 0 ? ["FizzBuzz"] : [, a]),
    outputOffsets: [
      { x: 50 * 2, y: 50 * 2 },
      { x: 0, y: 50 * 2 },
    ],
  });
  addOperatorToArea({
    x: x + 50 * 0,
    y: y + 50 * 2,
    name: "%3",
    fn: (a) => (a % 3 == 0 ? ["Fizz"] : [, a]),
    outputOffsets: [
      { x: 50 * 2, y: 0 },
      { x: 0, y: 50 * 2 },
    ],
  });
  addOperatorToArea({
    x: x + 50 * 0,
    y: y + 50 * 4,
    name: "%5",
    fn: (a) => (a % 5 == 0 ? ["Buzz"] : [, a]),
    outputOffsets: [
      { x: 50 * 2, y: -50 * 2 },
      { x: 50 * 2, y: 0 },
    ],
  });
  addOperatorToArea({
    x: x + 50 * 2,
    y: y + 50 * 4,
    name: "id",
    fn: (a) => a,
    outputOffsets: [{ x: 0, y: -50 * 2 }],
  });

  addBoxToArea({
    x: x - 50,
    y: y + -50 * 3,
    value: 15,
    name: "n",
  });
  addOperatorToArea({
    x: x + 50 * 0,
    y: y + -50 * 2,
    name: "gen",
    fn: function gen(n): number[] {
      if (n === 0) {
        return [];
      } else if (n === 1) {
        return [0, n];
      } else {
        return [n - 1, gen(n - 1)[1] + 1];
      }
    },
    outputOffsets: [
      { x: 50, y: 0 },
      { x: 0, y: 50 * 2 },
    ],
  });
  addOperatorToArea({
    x: x + 50,
    y: y + -50 * 2,
    name: "slow",
    fn: (a) => ({ value: a, speed: 1 }),
    outputOffsets: [{ x: -50 * 1, y: 0 }],
  });

  addOperatorToArea({
    x: x + 50 * 3,
    y: y + -50 * 4,
    name: "0-n",
    fn: (a) => {
      // gen numbers from 0 to a
      const n = [];
      for (let i = 0; i <= a; i++) {
        n.push(i);
      }
      return n;
    },
  });

  animateBoxLines();
  requestAnimationFrame(draw);
}

// function to create multiple operators in a line
// using addOperatorToArea
function createLineOfOperators({
  x,
  y,
  count,
  name,
  fn,
  outputOffsets,
}: {
  x: number;
  y: number;
  count: number;
  name?: string;
  fn?: (b: any) => any;
  outputOffsets?: { x: number; y: number }[];
}) {
  for (let i = 0; i < count; i++) {
    addOperatorToArea({
      x: x + i * GRID_SIZE,
      y,
      name,
      fn,
      outputOffsets,
    });
  }
}

// function to create multiple boxes in a line
// using addBoxToArea
function createLineOfBoxes({
  x,
  y,
  count,
  value,
}: {
  x: number;
  y: number;
  count: number;
  value?: number;
}) {
  for (let i = 0; i < count; i++) {
    addBoxToArea({ x: x + i * GRID_SIZE, y, value });
  }
}

init();
