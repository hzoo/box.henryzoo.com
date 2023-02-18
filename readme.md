##

- cmd/meta + click = create box
- shift + click + drag = create operator
- space + drag = pan
- option/alt + drag = update box value

## notes

- [x] take up screen
- [x] values are shown as boxes?
- [x] operators are just template boxes with lines? input/output that carries boxes around?
- how would multiple inputs work?
- [x] multiple outputs: can return an array in the operator (works as if/else)
- [x] animate operator box lines to show flow of boxes
  - [x] length user-made
  - or lengthens based on complexity?
- what about looping, debugging, logging?
- parameterize operators?
- input area should also move if hovered over?
- `+1` operator as it's own box, what if it had it's own canvas (like a google maps type zoom in and out), or like stack trace debugger that can freeze when going in and out of these boxes
- export/save current state to url/json/commands
- types? would be interesting to reject (send back to old pos + color) a value drop on operator if doesn't fit type (string when it expects a number etc), could use TS parser or runtime check + throw error
- fn just generates a lot of values
  - simulate mousemove/mousedown as creating inputs? one could have the code itself as series of boxes
- how to handle function composition, naming, scope, variables?
- maybe each return statement is it's own output location? Or if nothing is returned, return the value to another location.

## todo

- [ ] hover over boxes to view stack underneath, or fan out animation?
- [ ] fn abstraction (nested canvas?)
- [ ] easy way to copy paste a layout for demo or save to disk?
- [ ] allow dragging to change output loc
- [ ] cloned fns + differentiate global/local scope?

## metaphors

- tower defense game (inputs as enemies?, blocks/functions as towers, need to turn inputs into certain values?)
- ant colony, ant mill/death spiral
- worm inching a long
- flock of birds migrating
- boring factory assembly line
- hand or deck of cards for multiple in one space?
- sinks and sources?
- how does this relate to music, changing keys/scales?
