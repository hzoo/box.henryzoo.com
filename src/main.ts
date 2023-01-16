export {};

type Coord = {
  x: number;
  y: number;
};

type Box = Coord & {
  value: number;
  operator?: string;
  boxLength?: number;
  applyOperation?: (box: Box) => void;
};

type SelectedBox = Box & { new?: boolean; startX: number; startY: number };

const canvas = document.querySelector("#paper") as HTMLCanvasElement;
let ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
let boxSize = 50;
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.font = `${boxSize / 4}px Arial`;

// let boxes: Box[] = [];
// let operatorBoxes = new Map<string, Box>();
let boxes = new Map<string, Box>();
// @ts-ignore
window.boxes = boxes;
let selectedBox: SelectedBox | undefined = undefined;
let previewCoord: Coord | undefined = undefined;
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

function setBoxProperty<T extends keyof Box>(
  selectedBox: SelectedBox,
  property: T,
  value: Box[T]
) {
  let key = `${selectedBox.startX},${selectedBox.startY}`;
  let box = boxes.get(key);
  if (box) {
    box[property] = value;
  }
}

function draw(action?: string) {
  // clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // grid dots
  for (var x = 0; x < canvas.width; x += boxSize) {
    for (var y = 0; y < canvas.height; y += boxSize) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // preview box (where it would be placed if dropped on mouseup)
  if (previewCoord) {
    ctx.fillStyle = "#F1F5F9";
    ctx.fillRect(previewCoord.x, previewCoord.y, boxSize, boxSize);

    // debug
    // ctx.fillStyle = "black";
    // ctx.fillText(
    //   `${previewCoord.x},${previewCoord.y}`,
    //   previewCoord.x + boxSize / 2,
    //   previewCoord.y + boxSize / 2
    // );
  }

  // draw line from selected box to nearest box (if dragging)
  if (
    action == "dragging" &&
    selectedBox &&
    selectedBox.new &&
    selectedBox.operator
  ) {
    ctx.beginPath();
    ctx.moveTo(selectedBox.startX + boxSize, selectedBox.startY + boxSize / 2);
    // lineTo nearest dot/box
    let { x, y } = getClosestGrid(selectedBox.x, selectedBox.y);
    ctx.lineTo(x, y + boxSize / 2);
    ctx.stroke();
  }

  // draw each box
  for (let box of boxes.values()) {
    drawBorder(box.x, box.y, boxSize, !!box.operator);

    if (box.operator) {
      // @dev draw line out of box: moved to animateLine()

      // draw operator
      ctx.fillText(box.operator, box.x + boxSize / 2, box.y + boxSize + 20);
    } else {
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
function getClosestBox(x: number, y: number) {
  let { x: closestX, y: closestY } = getClosestGrid(x, y);
  let key = `${closestX},${closestY}`;
  if (boxes.has(key)) {
    return boxes.get(key);
  }
}

// box selection or new box
canvas.addEventListener("mousedown", function (event) {
  let { x, y } = getMousePos(canvas, event);
  let existingBox = getClosestBox(x, y);

  if (existingBox) {
    selectedBox = existingBox as SelectedBox;
    selectedBox.startX = selectedBox.x;
    selectedBox.startY = selectedBox.y;
    if (selectedBox) {
      offset.x = x - selectedBox.x - boxSize / 2;
      offset.y = y - selectedBox.y - boxSize / 2;
    }
    return;
  }

  let newBox = createBox({
    x: x - boxSize / 2,
    y: y - boxSize / 2,
    operator: event.shiftKey ? "+1" : undefined,
  });

  boxes.set(`${newBox.x},${newBox.y}`, newBox);
  selectedBox = { ...newBox, startX: newBox.x, startY: newBox.y, new: true };

  offset.x = 0;
  offset.y = 0;

  draw();
});

// function to create a box
function createBox({
  x,
  y,
  operator,
}: {
  x: number;
  y: number;
  operator?: string;
}): Box {
  // default value of 1
  let newBox: Box = { x, y, value: 1 };
  newBox.x = Math.round(newBox.x / boxSize) * boxSize;
  newBox.y = Math.round(newBox.y / boxSize) * boxSize;

  // default operator
  if (operator) {
    newBox.operator = "+1";
  }
  return newBox;
}

// dragging
canvas.addEventListener("mousemove", function (event) {
  if (!selectedBox) {
    return;
  }

  let { x, y } = getMousePos(canvas, event);

  selectedBox.x = x - offset.x - boxSize / 2;
  selectedBox.y = y - offset.y - boxSize / 2;

  let closest = getClosestGrid(x, y);

  // when moving existing boxes around
  if (!selectedBox.new) {
    // set closest grid as "preview"
    previewCoord = closest;
  }

  draw("dragging");
});

// dropping
canvas.addEventListener("mouseup", function (event) {
  if (selectedBox && !selectedBox.new && previewCoord) {
    // delete old box
    boxes.delete(`${selectedBox.startX},${selectedBox.startY}`);

    let x = previewCoord.x;
    let y = previewCoord.y;

    // set new box, if empty
    if (!boxes.has(`${x},${y}`)) {
      boxes.set(`${x},${y}`, {
        value: selectedBox.value,
        operator: selectedBox.operator,
        boxLength: selectedBox.boxLength,
        x,
        y,
      });
    } else {
      // if box is operator
      let box = boxes.get(`${x},${y}`);
      if (box && box.operator) {
        // apply operator to box value
        let value = selectedBox.value;
        if (box.operator === "+1") {
          value += 1;
        }

        // set new box
        // offset x and y to avoid overlap

        let newBox = {
          value,
          x: x + 1,
          y: y + 1,
        };
        boxes.set(`${newBox.x},${newBox.y}`, newBox);
      }
    }
    previewCoord = undefined;
  } else if (selectedBox && selectedBox.new) {
    setBoxProperty(
      selectedBox,
      "boxLength",
      Math.round(
        Math.sqrt(
          Math.pow(selectedBox.x - selectedBox.startX, 2) +
            Math.pow(selectedBox.y - selectedBox.startY, 2)
        ) / boxSize
      )
    );
  }

  draw();
  selectedBox = undefined;
});

// clear all boxes on press c
document.addEventListener("keydown", function (event) {
  if (event.key === "c") {
    boxes.clear();
    draw();
  }
});

function animate(box: Box, operatorBox: Box) {
  // Determine animation duration and distance
  const duration = 1000;
  const distance = {
    x: operatorBox.x - box.x,
    y: operatorBox.y - box.y,
  };

  // Set animation start time
  const startTime = performance.now();

  // Animate box position
  const animateBoxPosition = (time: number) => {
    const progress = (time - startTime) / duration;
    box.x = box.x + distance.x * progress;
    box.y = box.y + distance.y * progress;

    if (progress < 1) {
      requestAnimationFrame(animateBoxPosition);
    }
  };

  requestAnimationFrame(animateBoxPosition);
}

requestAnimationFrame(draw);

(function () {
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

    for (let box of boxes.values()) {
      if (box.operator) {
        // draw line as long as boxLength
        if (box.boxLength && box.boxLength > 0) {
          let dotCount = Math.floor(
            (box.boxLength * boxSize) / (dotSize + dotSpacing)
          );

          ctx.beginPath();
          ctx.setLineDash([dotSize, dotSpacing]);
          ctx.lineDashOffset = -Math.round(
            progress * (dotSize + dotSpacing) * dotCount
          );
          // ctx.moveTo(start.x, start.y);
          // ctx.lineTo(end.x, end.y);
          ctx.moveTo(box.x + boxSize, box.y + boxSize / 2);
          ctx.lineTo(
            box.x + boxSize + box.boxLength * boxSize,
            box.y + boxSize / 2
          );
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animateLine);
  }
  requestAnimationFrame(animateLine);
})();
