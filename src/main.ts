export {};

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

type KeyCoordinates = `${number},${number}`;

type Coord = {
  x: number;
  y: number;
};

type BoxHistory = {
  value: number;
  operatorName: string; // name of operator that caused this change
};

// maybe value should be a getter?
type Box = Coord & {
  name: string; // label
  value: any; // doesn't have to be a number actually
  end?: Coord; // where to animate towards
  history: BoxHistory[];
  updated?: boolean; // already operated on in loop
  speed?: number; // how fast to animate
};

type Operator = Box & {
  outputOffsets: Coord[]; // store offset from x,y
  auto: boolean; // WIP: if true, fast forward to next operator
  editLoc: number; // WIP: if true, allow editing of outputOffsets
};

type Area = {
  operatorBox?: Operator;
  boxes: Box[];
};

type _Selection = Operator & {
  new?: boolean;
  startX: number; // loc of mousedown to reset to if invalid mouseup
  startY: number;
};

type Selection = Prettify<_Selection>;

function isOperator(entity: Box | Operator): entity is Operator {
  return (entity as Operator).outputOffsets !== undefined;
}

function isBox(entity: Box | Operator): entity is Box {
  return isOperator(entity) === false;
}

let WIDTH = document.body.clientWidth;
let HEIGHT = document.body.clientHeight || 500;
const canvas = (function () {
  try {
    document.getElementById("canvas")?.remove();
  } catch (e) {
    console.log(e);
  }
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<canvas width="${WIDTH}" height="${HEIGHT}" id="canvas"></canvas>`
  );
  return document.getElementById("canvas") as HTMLCanvasElement;
})();

const observer = new ResizeObserver((_) => {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  // draw();
});
observer.observe(canvas);

let GRID_SIZE = 50;
let drawSpeed = 1;

function createRenderer(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${GRID_SIZE / 4}px Arial`;

  return {
    strokeRect(x: number, y: number, sizeX: number, sizeY: number) {
      ctx.fillStyle = "black";
      let { x: _x, y: _y } = applyPan(x, y);
      ctx.strokeRect(_x, _y, sizeX, sizeY);
    },
    drawBorder(x: number, y: number, size: number, dotted = false) {
      ctx.fillStyle = "black";
      ctx.lineDashOffset = 0;
      if (dotted) {
        ctx.setLineDash([5, 5]);
      } else {
        ctx.setLineDash([]);
      }
      let { x: _x, y: _y } = applyPan(x, y);
      ctx.strokeRect(_x, _y, size, size);
    },
    drawLogs() {
      ctx.textAlign = "left";
      // draw logs
      for (let i = 0; i < canvasLogs.length; i++) {
        this.fillText(canvasLogs[i], mouse.x + 5, mouse.y - 30 - i * 20);

        let textWidth = ctx.measureText(canvasLogs[i]).width;
        this.strokeRect(
          mouse.x,
          mouse.y - (canvasLogs.length + 1) * 20 - 8,
          textWidth + 10,
          (canvasLogs.length + 1) * 20 + 5
        );
      }
      // fixedCanvasLog;
      if (fixedCanvasLog) {
        this.fillText(fixedCanvasLog, mouse.x + 5, mouse.y - 12);
      }
      ctx.textAlign = "center";
    },

    // wrap ctx.fillRect with pan
    fillRect(x: number, y: number, size: number) {
      let { x: _x, y: _y } = applyPan(x, y);
      ctx.fillRect(_x, _y, size, size);
    },

    // wrap ctx.fillText with pan
    fillText(text: string, x: number, y: number) {
      let { x: _x, y: _y } = applyPan(x, y);
      ctx.fillText(text, _x, _y);
    },

    drawLine(startCoord: Coord, endCoord: Coord) {
      let { x: startX, y: startY } = applyPan(startCoord.x, startCoord.y);
      let { x: endX, y: endY } = applyPan(endCoord.x, endCoord.y);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    },

    drawBox(box: Box) {
      ctx.strokeStyle = "black";
      ctx.fillStyle = "white";
      this.fillRect(box.x, box.y, GRID_SIZE);
      ctx.fillStyle = "black";
      this.drawBorder(box.x, box.y, GRID_SIZE);

      // draw value
      let text = box.value.toString();
      this.fillText(text, box.x + GRID_SIZE / 2, box.y + GRID_SIZE / 2);

      // draw name if there is one
      if (box.name) {
        this.fillText(box.name, box.x + GRID_SIZE / 2, box.y - 10);
      }
    },

    drawBoxStack(x: number, y: number, length: number) {
      ctx.beginPath();
      ctx.arc(
        x + GRID_SIZE + 7 + pan.x,
        y + GRID_SIZE + 8 + pan.y,
        9,
        0,
        2 * Math.PI
      );
      ctx.strokeStyle = "#f87171";
      ctx.stroke();
      this.fillText(`${length}`, x + GRID_SIZE + 7, y + GRID_SIZE + 9);
    },

    drawGrid() {
      let startX = -pan.x + (pan.x % GRID_SIZE);
      let startY = -pan.y + (pan.y % GRID_SIZE);
      let endX = startX + canvas.width;
      let endY = startY + canvas.height;
      for (let i = startX; i < endX; i += GRID_SIZE) {
        for (let j = startY; j < endY; j += GRID_SIZE) {
          this.fillRect(i, j, 2);
        }
      }
    },

    drawPreviewBox() {
      // preview box (where it would be placed if dropped on mouseup)
      if (on.drag) {
        ctx.fillStyle = "rgba(241, 245, 249, 0.7)";
        let { x, y } = getClosestGrid(mouse.x, mouse.y);
        this.fillRect(x, y, GRID_SIZE);
        ctx.fillStyle = "black";

        // debug
        // ctx.fillText(`${x},${y}`, x + GRID_SIZE / 2, y + GRID_SIZE / 2);
      }
    },

    draw() {
      // clear canvas in animation frame
      // ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "black";

      this.drawGrid();

      let operatorAreas = [];
      let boxesOnlyAreas = [];

      // draw not moving boxes first
      for (let area of areas.values()) {
        let { operatorBox, boxes } = area;

        if (operatorBox) {
          operatorAreas.push(area);
          continue;
        }

        for (let box of boxes) {
          this.drawBox(box);
        }

        if (boxes.length > 1) {
          boxesOnlyAreas.push(area);
        }
      }

      for (let area of operatorAreas) {
        let { operatorBox, boxes } = area;

        if (!operatorBox) {
          return;
        }

        // draw each operator
        if (operatorBox!) {
          if (operatorBox.name.startsWith("is")) {
            ctx.strokeStyle = "red";
          } else {
            ctx.strokeStyle = "black";
          }

          this.drawBorder(operatorBox.x, operatorBox.y, GRID_SIZE, true);

          // move y position up or down depending on if there is an operator above it
          let y = operatorBox.y - 10;
          let x = operatorBox.x + GRID_SIZE / 2;
          let above = getClosestArea(operatorBox.x, operatorBox.y - GRID_SIZE);
          if (above && above.operatorBox) {
            y = operatorBox.y + GRID_SIZE + 12;

            // if also below, move to the left
            let below = getClosestArea(
              operatorBox.x,
              operatorBox.y + GRID_SIZE
            );
            if (below && below.operatorBox) {
              y = operatorBox.y + GRID_SIZE / 2;
              // use ctx.measureText to get width of text
              let m = ctx.measureText(`${operatorBox.name}`);
              x = operatorBox.x - m.width;
            }
          }

          this.fillText(`${operatorBox.name}`, x, y);
        }

        // draw each moving box last
        for (let box of boxes) {
          // don't draw if selectedBox
          if (
            selectedEntity &&
            selectedEntity.x == box.x &&
            selectedEntity.y == box.y
          ) {
            continue;
          }

          // change box value
          if (
            !box.updated &&
            box.x == operatorBox.x &&
            box.y == operatorBox.y
          ) {
            // animate the box towards the end of the operator box
            box.end = {
              x: operatorBox.x + operatorBox.outputOffsets[0].x,
              y: operatorBox.y + operatorBox.outputOffsets[0].y,
            };

            let result = operators[operatorBox.name](box.value);

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

                // add new box
                area.boxes.push({
                  name: "",
                  updated: true,
                  x: box.x,
                  y: box.y,
                  end: {
                    x: operatorBox.x + end.x,
                    y: operatorBox.y + end.y,
                  },
                  value: result[i],
                  history: [
                    {
                      operatorName: operatorBox.name,
                      value: operatorBox.value,
                    },
                  ],
                });
              }
            } else if (result?.constructor === Object) {
              if (result?.name) box.name = result.name;
              if (result?.value) box.value = result.value;
              if (result?.end) box.end = result.end;
              if (result?.speed) box.speed = result.speed;
            } else if (operatorBox.name.startsWith("is")) {
              // move down
              if (result == false) {
                box.end = {
                  x: operatorBox.x + operatorBox.outputOffsets[0].x,
                  y: operatorBox.y + operatorBox.outputOffsets[0].y + GRID_SIZE,
                };
                if (operatorBox.outputOffsets[1]) {
                  box.end = {
                    x: operatorBox.x + operatorBox.outputOffsets[1].x,
                    y: operatorBox.y + operatorBox.outputOffsets[1].y,
                  };
                }
              }
            } else if (result == "") {
              area.boxes = area.boxes.filter((b) => b !== box);
            } else {
              box.value = result;
            }

            box.history.push({
              operatorName: operatorBox.name,
              value: box.value,
            });
          }

          let end = box.end;
          if (end) {
            // only if not already at the end
            if (box.x !== end.x) {
              box.x += (end.x - box.x) * 0.05 * (box.speed || drawSpeed);
            }
            if (box.y !== end.y) {
              box.y += (end.y - box.y) * 0.05 * (box.speed || drawSpeed);
            }

            if (operatorBox.auto) {
              box.x = end.x - 0.1;
              box.y = end.y - 0.1;
            }

            // account for negative differnces using math.abs
            if (
              (Math.abs(end.x - box.x) < 1 && box.x !== end.x) ||
              (Math.abs(end.y - box.y) < 1 && box.y !== end.y)
            ) {
              box.updated = true;
              box.x = end.x;
              box.y = end.y;
              box.end = undefined;
              box.speed = undefined;

              // remove box from area
              area.boxes = area.boxes.filter((b) => b !== box);
              // add to new area
              addEntityToArea(box);
            }
          } else {
            box.updated = false;
          }

          this.drawBox(box);
        }
      }

      // draw length of box stacks on top
      for (let { boxes } of boxesOnlyAreas) {
        if (boxes.length > 1) {
          this.drawBoxStack(boxes[0].x, boxes[0].y, boxes.length);
        }
      }

      this.drawPreviewBox();

      // draw selected box last
      if (selectedEntity && !isOperator(selectedEntity)) {
        this.drawBox(selectedEntity);
      }

      this.drawLogs();
    },
    drawOperatorLine(
      operatorBox: Operator,
      {
        boxOffset,
        dotSize,
        dotSpacing,
        progress,
      }: {
        boxOffset: Coord;
        dotSize: number;
        dotSpacing: number;
        progress: number;
      }
    ) {
      let dotCount = Math.floor(
        Math.sqrt(Math.pow(boxOffset.x, 2) + Math.pow(boxOffset.y, 2)) /
          (dotSize + dotSpacing)
      );

      ctx.setLineDash([dotSize, dotSpacing]);
      ctx.lineDashOffset = -Math.round(
        progress * (dotSize + dotSpacing) * dotCount
      );
      // different color for moving line, so it's easier to see
      ctx.strokeStyle = "#78350f";
      // draw line
      this.drawLine(
        {
          x: operatorBox.x + GRID_SIZE / 2,
          y: operatorBox.y + GRID_SIZE / 2,
        },
        {
          x: operatorBox.x + boxOffset.x + GRID_SIZE / 2,
          y: operatorBox.y + boxOffset.y + GRID_SIZE / 2,
        }
      );
    },
    clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    ctx,
  };
}

const Renderer = createRenderer(canvas);

// coordinate areas contain boxes and potential operator
let areas: Map<KeyCoordinates, Area> = new Map();
// @ts-ignore
window.areas = areas;

// create mapping of operator names to functions
let operators: { [key: string]: (b: any) => any } = {};
// @ts-ignore
window.operators = operators;
operators.id = (a) => a;

// on left click (existing or new), or right click (existing)
let selectedEntity: Selection | undefined = undefined;
let on = {
  space: false,
  meta: false,
  shift: false,
  alt: false,
  drag: false,
  edit: false,
};

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

function isAreaEmpty(key: KeyCoordinates): boolean {
  return !areas.has(key) || _isEmptyArea(areas.get(key) as Area);
}

// function to check closest box Coordinate
function getClosestArea(x: number, y: number): Area | undefined {
  // let coord = getClosestGrid(x, y);
  // let key: KeyCoordinates = toKey(coord.x, coord.y);
  let { x: closestX, y: closestY } = getClosestGrid(x, y);
  let key: KeyCoordinates = `${closestX},${closestY}`;
  if (areas.has(key)) {
    return areas.get(key);
  }

  return undefined;
}

function toKey(x: number, y: number): KeyCoordinates {
  return `${x},${y}`;
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

function applyPan(x: number, y: number): { x: number; y: number } {
  return { x: x + pan.x, y: y + pan.y };
}

function reversePan(x: number, y: number): { x: number; y: number } {
  return { x: x - pan.x, y: y - pan.y };
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

function getAbsMousePos(canvas: HTMLCanvasElement, event: MouseEvent) {
  var rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function updateContextMenu(
  action: "existing-box" | "existing-operator" | "new",
  entity?: Operator
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
    `;
    if (entity) {
      entity.outputOffsets.forEach((_, index) => {
        index += 1;
        contextMenu.innerHTML += `
          <div class="context-menu-item" data-action="edit-loc-${index}">Edit Loc ${index}</div>
        `;
      });
    }
    contextMenu.innerHTML += `<div class="context-menu-item" data-action="delete">Delete</div>`;
  } else if (action === "new") {
    contextMenu.innerHTML = `
      <div class="context-menu-item" data-action="create-value">+ Value (□)</div>
      <div class="context-menu-item" data-action="create-operator">+ Operator (□-)</div>
    `;
  }
}

function getCoordFromHtmlDivElement(element: HTMLDivElement): Coord {
  let grid = getClosestGrid(
    parseInt(element.style.left),
    parseInt(element.style.top)
  );
  return reversePan(grid.x, grid.y); // handle pan
}

function createInput(property: "name" | "value") {
  if (!selectedEntity) {
    return;
  }

  let prop = selectedEntity[property];

  // create input element
  let input = document.createElement("input");
  if (property == "value") {
    // input.type = "number";
  } else {
    input.type = "text";
  }
  input.value = prop.toString();
  input.style.position = "absolute";
  input.style.left = `${selectedEntity.x + pan.x}px`; // handle pan
  input.style.top = `${selectedEntity.y + pan.y}px`; // handle pan
  input.style.width = `${GRID_SIZE}px`;
  input.style.height = `${GRID_SIZE}px`;

  document.body.appendChild(input);
  input.focus();

  function handleSubmit(event: Event) {
    input.removeEventListener("keydown", handleSubmit);
    input.removeEventListener("blur", handleSubmit);
    input.remove();
    if (!selectedEntity) {
      return;
    }

    let val = (event.target as HTMLInputElement).value;
    if (property == "value") {
      // selectedEntity[property] = parseInt(val) || 0;
      selectedEntity[property] = val;
      if (selectedEntity.name === "drawSpeed") {
        drawSpeed = parseInt(val);
      }
    } else if (property == "name") {
      // copy fn to new name
      if (!operators[val]) {
        operators[val] = operators[selectedEntity.name];
      }

      selectedEntity[property] = val;
    }
  }

  input.addEventListener("keydown", function (event: KeyboardEvent) {
    if (event.key === "Enter") {
      handleSubmit(event);
    }
  });

  input.addEventListener("blur", function (event: Event) {
    handleSubmit(event);
  });
}

function deleteEntity() {
  if (!selectedEntity) {
    return;
  }
  let area = getClosestArea(selectedEntity.x, selectedEntity.y);
  if (area) {
    if (isOperator(selectedEntity)) {
      delete area.operatorBox;
    } else {
      area.boxes = area.boxes.filter((box) => box !== selectedEntity);
    }

    let coord: KeyCoordinates = `${selectedEntity.x},${selectedEntity.y}`;
    if (isAreaEmpty(coord)) {
      areas.delete(coord);
    }
  }
}

function editInput() {
  if (!selectedEntity) {
    return;
  }

  if (isOperator(selectedEntity)) {
    // create input element
    let input = document.createElement("textarea");
    input.style.position = "absolute";
    input.style.left = `${selectedEntity.x + pan.x}px`; // handle pan
    input.style.top = `${selectedEntity.y + pan.y}px`; // handle pan
    input.style.width = `${GRID_SIZE * 3}px`;
    input.style.height = `${GRID_SIZE}px`;
    input.value = operators[selectedEntity.name].toString();
    document.body.appendChild(input);
    input.focus();

    function handleChange(event: Event) {
      if (!selectedEntity) {
        return;
      }

      let inputValue = (event.target as HTMLInputElement).value;
      try {
        let evalResult = new Function(`return ${inputValue}`);
        let operator = evalResult();
        operators[selectedEntity.name] = operator;
        let res = operator(1);
        if (Array.isArray(res)) {
          if (res.length > selectedEntity.outputOffsets.length) {
            for (
              let i = selectedEntity.outputOffsets.length;
              i < res.length;
              i++
            ) {
              selectedEntity.outputOffsets.push({
                x: GRID_SIZE,
                y: i * GRID_SIZE,
              });
            }
          } else if (res.length < selectedEntity.outputOffsets.length) {
            selectedEntity.outputOffsets = selectedEntity.outputOffsets.slice(
              0,
              res.length
            );
          }
        } else {
          if (selectedEntity.name.startsWith("is")) {
          } else {
            selectedEntity.outputOffsets = selectedEntity.outputOffsets.slice(
              0,
              1
            );
          }
        }
        // log(`set ${selectedEntity.name} to ${operator.toString()}`);
      } catch (e) {
        // log(`error setting ${selectedEntity.name} to ${inputValue}`);
      }

      input.removeEventListener("keydown", handleChange);
      input.removeEventListener("blur", handleChange);
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
}

let inspectedEntity: Selection | undefined;

function createContextMenu() {
  // menu needs to show up over the canvas correctly
  let contextMenu = document.createElement("div");
  contextMenu.classList.add("context-menu");
  contextMenu.style.position = "absolute";
  contextMenu.style.border = "1px solid black";
  contextMenu.style.backgroundColor = "white";

  // add event listener to menu items
  contextMenu.addEventListener("click", function (event: Event) {
    let action = (event.target as HTMLInputElement).getAttribute("data-action");
    let contextMenuCoord = getCoordFromHtmlDivElement(contextMenu);

    if (inspectedEntity) {
      selectedEntity = inspectedEntity;
      selectedEntity.startX = selectedEntity.x;
      selectedEntity.startY = selectedEntity.y;
    }

    switch (action) {
      case "edit-name":
        createInput("name");
        break;
      case "edit":
        editInput();
        break;
      case "delete":
        deleteEntity();
        break;
      case "create-value":
        addEntityToArea(createBox(contextMenuCoord));
        break;
      case "create-operator":
        addEntityToArea(createOperator(contextMenuCoord));
        break;
    }

    // if starts with edit-loc
    if (action && action.startsWith("edit-loc")) {
      // as if selecting operator line for the first time
      // parse the number from the action
      let loc = parseInt(action.split("-")[2]);
      selectedEntity!.editLoc = loc;
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

function handleRightClick(event: MouseEvent) {
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
  contextMenu.style.left = `${mouse.x + pan.x}px`; // need absolute position
  contextMenu.style.top = `${mouse.y + pan.y}px`; // need absolute position

  // existing area
  if (area) {
    if (area.boxes.length > 0) {
      // select last box
      inspectedEntity = area.boxes[area.boxes.length - 1] as Selection;
      on.edit = true;
      updateContextMenu("existing-box");
    } else if (area.operatorBox) {
      // select operator
      inspectedEntity = area.operatorBox as Selection;
      on.edit = true;
      updateContextMenu("existing-operator", inspectedEntity);
    }
  } else {
    updateContextMenu("new");
  }
}

function cloneEntity(entity: Selection): Selection {
  let clone = JSON.parse(JSON.stringify(entity));
  if (isOperator(entity)) {
    clone.name = entity.name;
  }
  return clone;
}

// box selection or new box
function handleMousedown(event: MouseEvent): void {
  // if right click or space pressed, return
  if (event.button !== 0 || on.space) {
    return;
  }
  let contextMenu = document.querySelector(".context-menu") as HTMLDivElement;
  if (contextMenu && contextMenu.style.display !== "none") {
    hideContextMenu();
    return;
  }

  if (on.edit) {
    on.edit = false;
    return;
  }

  let area = getClosestArea(mouse.x, mouse.y);

  // existing area
  if (area) {
    // prioritize operator
    if (area.operatorBox) {
      selectedEntity = area.operatorBox as Selection;
    } else if (area.boxes.length > 0) {
      // select last box
      selectedEntity = area.boxes[area.boxes.length - 1] as Selection;
    } else {
      return;
    }

    // clone selected entity
    if (event.metaKey) {
      selectedEntity = cloneEntity(selectedEntity);
      selectedEntity.x *= 100; // TODO: hack to make sure it's not in the same area
      selectedEntity.y *= 100;
      addEntityToArea(
        selectedEntity,
        `${selectedEntity.x},${selectedEntity.y}`
      );
    }

    selectedEntity.startX = selectedEntity.x;
    selectedEntity.startY = selectedEntity.y;
  } else {
    // new area
    let newEntity;

    if (event.shiftKey) {
      newEntity = addEntityToArea(
        createOperator({
          x: mouse.x - GRID_SIZE / 2,
          y: mouse.y - GRID_SIZE / 2,
        })
      );
    } else if (event.metaKey) {
      newEntity = addEntityToArea(
        createBox({
          x: mouse.x - GRID_SIZE / 2,
          y: mouse.y - GRID_SIZE / 2,
        })
      );
    } else {
      return;
    }

    selectedEntity = {
      ...newEntity,
      startX: newEntity.x,
      startY: newEntity.y,
      new: true,
    } as Selection;
  }
}

function handleDrag(event: MouseEvent): void {
  mouse = getMousePos(canvas, event);
  // logFixed(`${mouse.x}, ${mouse.y}`);
  if (!selectedEntity) {
    // if left click and space pressed, pan
    if (event.buttons === 1 && on.space) {
      canvas.style.cursor = "grabbing";
      pan.x += event.movementX;
      pan.y += event.movementY;
      // draw();
    }
  } else if (on.alt) {
    // todo: fix scale
    if (isBox(selectedEntity)) {
      if (typeof selectedEntity.value == "number") {
        selectedEntity.value += Math.round(event.movementX / 4);
        if (selectedEntity.name === "drawSpeed") {
          drawSpeed = selectedEntity.value;
        }
      }
    }
  } else if (!on.edit) {
    on.drag = true;
    canvas.style.cursor = "move";
    selectedEntity.x += event.movementX;
    selectedEntity.y += event.movementY;
  }
}

function handleDrop(): void {
  on.drag = false;
  canvas.style.cursor = "default";
  if (!selectedEntity) {
    on.edit = false;
    return;
  }
  let startCoord: KeyCoordinates = `${selectedEntity.startX},${selectedEntity.startY}`;
  let startArea = areas.get(startCoord)!;

  let { x, y } = getClosestGrid(mouse.x, mouse.y);
  let key: KeyCoordinates = `${x},${y}`;

  // when moving existing boxes around
  if (!selectedEntity.new && !on.edit) {
    if (startArea) {
      // delete old box
      if (isOperator(selectedEntity)) {
        startArea!.operatorBox = undefined;
      } else if (startArea.boxes) {
        startArea.boxes = startArea.boxes.filter(
          (box) => box !== selectedEntity
        );
      }
    }

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
          boxes: [selectedEntity],
        });
      }
    } else {
      // if existing area

      if (isOperator(selectedEntity)) {
        // if area already has operator
        if (areas.get(key)!.operatorBox) {
          // move operator back to old area
          areas.get(startCoord)!.operatorBox = {
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

    if (isAreaEmpty(startCoord)) {
      areas.delete(startCoord);
    }
  } else {
    if (startArea?.operatorBox) {
      if (!selectedEntity.editLoc && !selectedEntity.new) {
        return;
      }
      let offset = selectedEntity.editLoc - 1 || 0;
      // set output location of operator to mouse area coord
      startArea.operatorBox.outputOffsets[offset] = {
        x: x - startArea.operatorBox.x,
        y: y - startArea.operatorBox.y,
      };
      selectedEntity.editLoc = 0;
    }
  }

  // draw();
  selectedEntity = undefined;
  inspectedEntity = undefined;
  on.edit = false;
}

function animateBoxLines() {
  let dotSpacing = 10;
  let dotSize = 5;
  let animationDuration = 4000;
  let startTime = performance.now();
  function animateLine() {
    Renderer.clear();

    let time = performance.now();
    let progress = (time - startTime) / animationDuration;
    if (progress > 1) {
      progress = 1;
      startTime = performance.now();
    }
    let { x, y } = getClosestGrid(mouse.x, mouse.y);

    for (let { operatorBox } of areas.values()) {
      if (operatorBox) {
        for (let i = 0; i < operatorBox.outputOffsets.length; i++) {
          let boxOffset = operatorBox.outputOffsets[i];

          // new operator line
          if (
            (selectedEntity?.new || selectedEntity?.editLoc == i + 1) &&
            operatorBox.x == selectedEntity.startX &&
            operatorBox.y == selectedEntity.startY
          ) {
            boxOffset = {
              x: x - operatorBox.x,
              y: y - operatorBox.y,
            };
          }

          Renderer.drawOperatorLine(operatorBox, {
            boxOffset,
            dotSize,
            dotSpacing,
            progress,
          });
        }

        if (
          operatorBox.outputOffsets.length == 1 &&
          operatorBox.name.startsWith("is")
        ) {
          let boxOffset = {
            x: GRID_SIZE,
            y: GRID_SIZE,
          };

          Renderer.drawOperatorLine(operatorBox, {
            boxOffset,
            dotSize,
            dotSpacing,
            progress,
          });
        }
      }
    }

    Renderer.draw();
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
        operatorName: "init",
        value: value || 1,
      },
    ],
  };
  newBox.x = Math.round(newBox.x / GRID_SIZE) * GRID_SIZE;
  newBox.y = Math.round(newBox.y / GRID_SIZE) * GRID_SIZE;

  return newBox;
}

// TODO: history for operator?
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

  if (name) {
    // check if operator already in mapping
    if (!operators[name] && fn) {
      operators[name] = fn;
    }
    newOperator.name = name;

    let res = operators[name](1);
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

    // newOperator.auto = true;
  } else {
    newOperator.name = "id";
  }

  return newOperator;
}

// add a box or operator to an area coordinate
function addEntityToArea(
  entity: Box | Operator,
  keyCoordinates?: KeyCoordinates
) {
  let area = getClosestArea(entity.x, entity.y);
  if (area) {
    if (isOperator(entity)) {
      area.operatorBox = entity;
    } else {
      area.boxes.push(entity);
    }
  } else {
    let coord: KeyCoordinates = `${entity.x},${entity.y}`;
    if (keyCoordinates) {
      coord = keyCoordinates;
    }
    if (isOperator(entity)) {
      areas.set(coord, {
        boxes: [],
        operatorBox: entity,
      });
    } else {
      areas.set(coord, {
        boxes: [entity],
      });
    }
  }
  return entity;
}

function init() {
  canvas.addEventListener("contextmenu", handleRightClick);
  canvas.addEventListener("mousedown", handleMousedown);
  canvas.addEventListener("mousemove", handleDrag);
  canvas.addEventListener("mouseup", handleDrop);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      hideContextMenu();
    } else if (event.key === " ") {
      on.space = true;
      canvas.style.cursor = "grab";
    } else if (event.key === "Meta") {
      if (mouse.x !== 0 && mouse.y !== 0) {
        on.meta = true;
      }
    } else if (event.key === "Shift") {
      on.shift = true;
      // canvas.style.cursor = "move";
    } else if (event.key === "Alt") {
      on.alt = true;
      canvas.style.cursor = "ew-resize";
    }
  });

  document.addEventListener("keyup", function (event) {
    canvas.style.cursor = "default";
    if (event.key === " ") {
      on.space = false;
    } else if (event.key === "Meta") {
      on.meta = false;
    } else if (event.key === "Shift") {
      on.shift = false;
    } else if (event.key === "Alt") {
      on.alt = false;
    }
  });

  let x = 0;
  let y = 0;

  addEntityToArea(createBox({ x: 500, y: 50, name: "drawSpeed", value: 1 }));
  addEntityToArea(
    createOperator({
      x: x + 50 * 12,
      y: y + 50,
      name: "slow",
      fn: (a) => ({ value: a, speed: drawSpeed / 3 }),
      outputOffsets: [{ x: -50 * 1, y: 0 }],
    })
  );

  x = 50;
  y = 100;
  addEntityToArea(
    createOperator({
      x,
      y: y + 100,
      name: "double",
      fn: (b: number) => b * 2,
    })
  );
  addEntityToArea(
    createOperator({
      x: x + 50,
      y: y + 100,
      name: "clone",
      fn: (a) => [a, a],
    })
  );

  x = 100;
  y = 50;
  addEntityToArea(createBox({ x: 100, y: 50, value: 1 }));
  addEntityToArea(createBox({ x: 50, y, value: 2 }));
  addEntityToArea(
    createOperator({
      x,
      y,
      name: "isEven",
      fn: (b) => b % 2 === 0,
    })
  );
  addEntityToArea(
    createOperator({
      x: x - 50,
      y,
      name: "id",
    })
  );
  x = 100;
  y = 450;
  addEntityToArea(
    createOperator({
      x,
      y,
      name: "is %3&&%5",
      fn: (a) => a % 3 == 0 && a % 5 == 0,
      outputOffsets: [
        { x: 50 * 2, y: 50 * 0 },
        { x: 0, y: 50 * 2 },
      ],
    })
  );
  addEntityToArea(
    createOperator({
      x: x + 50 * 2,
      y,
      name: "FizzBuzz",
      fn: () => "FizzBuzz",
      outputOffsets: [{ x: 50 * 2, y: 50 * 2 }],
    })
  );
  addEntityToArea(
    createOperator({
      x: x + 50 * 0,
      y: y + 50 * 2,
      name: "is %3",
      fn: (a) => a % 3 == 0,
      outputOffsets: [
        { x: 50 * 2, y: 0 },
        { x: 0, y: 50 * 2 },
      ],
    })
  );
  addEntityToArea(
    createOperator({
      x: x + 50 * 2,
      y: y + 50 * 2,
      name: "Fizz",
      fn: () => "Fizz",
      outputOffsets: [{ x: 50 * 2, y: 0 }],
    })
  );
  addEntityToArea(
    createOperator({
      x: x + 50 * 0,
      y: y + 50 * 4,
      name: "is %5",
      fn: (a) => a % 5 == 0,
      outputOffsets: [
        { x: 50 * 2, y: 0 },
        // { x: 50 * 2, y: 50 * 2 },
        { x: 50 * 4, y: -50 * 2 },
      ],
    })
  );
  addEntityToArea(
    createOperator({
      x: x + 50 * 2,
      y: y + 50 * 4,
      name: "Buzz",
      fn: () => "Buzz",
      outputOffsets: [{ x: 50 * 2, y: -50 * 2 }],
    })
  );

  addEntityToArea(
    createBox({
      x: x - 50 * 1,
      y: y + -50 * 2,
      value: 15,
      name: "n",
    })
  );

  x = 300;
  y = 250;
  addEntityToArea(
    createOperator({
      x,
      y,
      name: "is <4",
      fn: (a) => a < 4,
      outputOffsets: [
        { x: 50 * 1, y: 50 * 0 },
        { x: 50 * -1, y: 50 * 0 },
      ],
    })
  );
  addEntityToArea(
    createOperator({
      x: x + 50 * 1,
      y,
      name: "clone",
      outputOffsets: [
        { x: 50 * 1, y: 50 * -2 },
        { x: 50 * 1, y: 50 * 1 },
      ],
    })
  );
  addEntityToArea(
    createOperator({
      x: x + 50 * 2,
      y: y + 50 * -2,
      name: "+1",
      fn: (a) => a + 1,
      outputOffsets: [{ x: 50 * -2, y: 50 * 2 }],
    })
  );
  addEntityToArea(
    createOperator({
      x: x + 50 * -1,
      y: y + 50 * 0,
      name: "trash🗑️",
      fn: () => "",
      outputOffsets: [{ x: 50 * 0, y: 50 * 0 }],
    })
  );

  animateBoxLines();
}

init();
