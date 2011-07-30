$(function() {

    // Set up the canvas context.
    var canvas = $('#canvas');
    var context = canvas.get()[0].getContext('2d');
    context.width = canvas.width();
    context.height = canvas.height();
    context.lineCap = 'round';
    context.lineJoin = 'round';

    // Mousedown/drawing flag.
    drawing = false;

    // Container that stores each of the actions so that they can
    // be referenced dynamically by name. Triggered client-side by
    // the current user, or from the server via Socket.IO for all
    // other users for this drawing.
    var actions = {

        // Start drawing.
        mousedown: function(x, y, username, userID) {
            context.beginPath();
            context.moveTo(x, y);
        },

        // Draw.
        mousemove: function(x, y, username, userID) {
            context.lineTo(x, y);
            context.stroke();
        },

        load: function(imageData) {
            img = new Image();
            var interval = setInterval(function() {
                if (img.complete) {
                    context.drawImage(img, 0, 0);
                    clearTimeout(interval);
                }
            }, 100);
            img.src = imageData;
        },

        // User joining - add their name to the user list.
        join: function(username, userID) {
            if ($('#user-' + userID).length == 0) {
                $('#users').append('<li id="user-' + userID + '">' +
                                   '<img src="' + window.MEDIA_URL + 'photos/' + userID + '.20x20_q85_crop-smart.jpg">' +
                                   username + '</li>');
            }
        },

        // User leaving - remove their name from the user list.
        leave: function(username, userID) {
            if (userID != window.userID) {
                $('#user-' + userID).remove();
            }
        }

    };

    // Takes an array of args that represent one or more actions to call.
    // First arg is always the drawing ID as a guard to ensure actions are
    // only performed for the current drawing. Second arg is the act‭ion name
    // and the rest are args for that action. Since many sets of actions
    // can be sent from the server in one batch, we keep looping and test
    // for the argument length of the action being called, pulling the
    // required number of arguments off the list, until the entire list
    // is empty.
    var action = function(args) {
        while (args.length > 0) {
            if (args.shift() == window.drawingID) {
                var action = actions[args.shift()];
                var argLength = action.prototype.constructor.length;
                action.apply(null, args.slice(0, argLength));
                args = args.slice(argLength);
            }
        }
    };

    // The main handler for actions triggered client-side.
    // First wrap the arguments with the drawing ID and user vars,
    // perform the actual action client-side, and pass the action
    // and arguments off to the server via socket.io for broadcasting
    // to other users.
    var send = function() {
        var getArgs = function(args) {
            args = $.makeArray(args);
            args.unshift(window.drawingID);
            args.push(window.username, window.userID);
            return args;
        };
        action(getArgs(arguments));
        socket.send(getArgs(arguments));
    };

    // Socket.IO setup.
    var socket = new io.Socket();
    socket.connect();
    socket.on('connect', function() {
        send('join');
    });
    $(window).unload(function() {
        send('leave', canvas.get()[0].toDataURL('image/png'));
    });
    socket.on('message', function(args) {
        $('#loading').remove();
        action(args);
    });

    // Cross-browser pixel offset.
    var getCoords = function(event) {
        var offset = canvas.offset();
        return {x: event.pageX - offset.left, y: event.pageY - offset.top};
    };

    // Stop drawing on mouseup.
    canvas.mouseup(function() {
        drawing = false;
    });

    // Start drawing on mousedown.
    canvas.mousedown(function(event) {
        var coords = getCoords(event);
        drawing = true;
        send('mousedown', coords.x, coords.y);
    });

    // Draw on mousemove if drawing is currently on (eg mouse is down).
    canvas.mousemove(function(event) {
        if (drawing) {
            var coords = getCoords(event);
            send('mousemove', coords.x, coords.y);
        }
    });

});
