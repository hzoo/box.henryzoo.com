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

let selectedEntity: Selection | undefined = undefined;
let previewCoordinate: Coord | undefined = undefined;
let offset: Coord = {
  x: 0,
  y: 0,
};
let dragging = false;

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

function setOperatorProperty<T extends keyof Box>(
  selectedEntity: Selection,
  property: T,
  value: Box[T]
) {
  let key: Coordinates = `${selectedEntity.startX},${selectedEntity.startY}`;
  let area = areas.get(key);
  if (area?.operatorBox) {
    area.operatorBox[property] = value;
  }
}

function draw() {
  // clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

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
  if (
    dragging &&
    selectedEntity &&
    selectedEntity.new &&
    selectedEntity?.operator
  ) {
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

  for (let { operatorBox, boxes } of areas.values()) {
    // draw each operator
    if (operatorBox) {
      drawBorder(operatorBox.x, operatorBox.y, boxSize, true);

      // draw operator
      ctx.fillText(
        operatorBox.operator,
        operatorBox.x + boxSize / 2,
        operatorBox.y + boxSize + 20
      );

      // @dev draw line out of box moved to animateLine()
    }

    // draw each box
    for (let box of boxes) {
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

// box selection or new box
canvas.addEventListener("mousedown", function (event) {
  dragging = true;

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

function createOperator({ x, y }: { x: number; y: number }): Operator {
  let newOperator: Operator = createBox({ x, y }) as Operator;
  newOperator.operator = "+";

  return newOperator;
}

// dragging
canvas.addEventListener("mousemove", function (event) {
  if (!selectedEntity) {
    dragging = false;
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
  dragging = false;
  if (!selectedEntity) {
    return;
  }

  let area = areas.get(`${selectedEntity.startX},${selectedEntity.startY}`)!;

  if (!selectedEntity.new && previewCoordinate) {
    if (area) {
      // delete old box
      if (isOperator(selectedEntity)) {
        area!.operatorBox = undefined;
      } else if (area.boxes) {
        area.boxes = area.boxes.filter((box) => box !== selectedEntity);
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
        // add operator back to old area with starting coordinates
        areas.get(
          `${selectedEntity.startX},${selectedEntity.startY}`
        )!.operatorBox = {
          ...selectedEntity,
          x: selectedEntity.startX,
          y: selectedEntity.startY,
        };
      } else {
        // add box to existing area
        areas.get(key)!.boxes.push({ ...(selectedEntity as Box), x, y });
      }
    }
    previewCoordinate = undefined;
  } else if (selectedEntity.new) {
    if (area?.operatorBox) {
      area.operatorBox.boxLength = Math.round(
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
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animateLine);
  }
  requestAnimationFrame(animateLine);
}

function init() {
  // if (isOperator(newEntity)) {
  //   area.operatorBox = newEntity;
  // } else {
  //   area.boxes.push(newEntity);
  // }

  let area = areas.get("50,50")?.boxes.push(createBox({ x: 50, y: 50 }));

  // areas.set("50,50", {
  //   x: 50,
  //   y: 50,
  //   value: 1,
  // });

  // areas.set("100,100", {
  //   x: 100,
  //   y: 100,
  //   value: 1,
  //   operator: "+1",
  //   boxLength: 2,
  // });
  // areas.set("150,150", {
  //   x: 150,
  //   y: 150,
  //   value: 1,
  //   operator: "+1",
  //   boxLength: 4,
  // });

  animateBoxLines();
  requestAnimationFrame(draw);
}

init();
