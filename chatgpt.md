# chatgpt

> code that creates a smal box on click in js canvas

```js
var canvas = document.getElementById("myCanvas");
var ctx = canvas.getContext("2d");

canvas.addEventListener("click", function (event) {
  var rect = canvas.getBoundingClientRect();
  var x = event.clientX - rect.left;
  var y = event.clientY - rect.top;
  ctx.fillRect(x, y, 50, 50);
});
```

> awesome, can you add code that introduces functionality to let you select the created boxes and drag them around, also each box should contain the number 1

```js
var canvas = document.getElementById("myCanvas");
var ctx = canvas.getContext("2d");

var boxes = [];
var selectedBox = null;
var offset = {};

canvas.addEventListener("mousedown", function (event) {
  var rect = canvas.getBoundingClientRect();
  var x = event.clientX - rect.left;
  var y = event.clientY - rect.top;

  // check if a box was clicked
  for (var i = 0; i < boxes.length; i++) {
    if (
      x > boxes[i].x &&
      x < boxes[i].x + 50 &&
      y > boxes[i].y &&
      y < boxes[i].y + 50
    ) {
      selectedBox = boxes[i];
      offset.x = x - selectedBox.x;
      offset.y = y - selectedBox.y;
      return;
    }
  }

  // if no box was clicked, create a new one
  boxes.push({ x: x, y: y });
  selectedBox = boxes[boxes.length - 1];
  offset.x = 0;
  offset.y = 0;
});

canvas.addEventListener("mousemove", function (event) {
  if (selectedBox) {
    var rect = canvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    selectedBox.x = x - offset.x;
    selectedBox.y = y - offset.y;
    draw();
  }
});

canvas.addEventListener("mouseup", function (event) {
  selectedBox = null;
});

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (var i = 0; i < boxes.length; i++) {
    ctx.fillRect(boxes[i].x, boxes[i].y, 50, 50);
    ctx.fillStyle = "black";
    ctx.fillText("1", boxes[i].x + 20, boxes[i].y + 30);
  }
}
```

> ok can you add code to allow the boxes to snap to a grid
> of the same width and height of 50px when you
> let go of the mouse, like on mouseup

```js
canvas.addEventListener("mouseup", function (event) {
  if (selectedBox) {
    // snap to grid
    selectedBox.x = Math.round(selectedBox.x / 50) * 50;
    selectedBox.y = Math.round(selectedBox.y / 50) * 50;
    draw();
  }
  selectedBox = null;
});
```

> can you draw dots where the grid would be on the canvas

```js
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // draw grid
  ctx.fillStyle = "black";
  for (var x = 0; x < canvas.width; x += boxSize) {
    for (var y = 0; y < canvas.height; y += boxSize) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // draw boxes and text
  for (var i = 0; i < boxes.length; i++) {
    ctx.strokeRect(boxes[i].x, boxes[i].y, boxSize, boxSize);
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, boxes[i].x + boxSize / 2, boxes[i].y + boxSize / 2);
  }
}
```

> can you generalize the size so that the boxes can be a different number,
> make a new variable so that 50 isn't hardcoded, and same with the text

can you modify the code so that the box is created in a way that

> the cursor is the center of the box rather than offset due to dimensions
