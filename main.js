var gl;

var width;
var height;

var textureWidth;
var textureHeight;
var textureList = [];

var pendingLive = [];

var outputTexture = 0;
var sourceTexture = 1;

var requestFrame = function() {
    return window.requestAnimationFrame || 
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function(callback) {
            setTimeout(callback, 40);
        };
}();

var getFPS = function() {
    var thenTime = Date.now() / 1000;
    var fpsElement = document.getElementById("fps");
    var frameHistory = [];
    var frameIndex = 0;
    var totalFrameTime= 0;
    var frameNumber = 16;
    return function() {
        var nowTime = Date.now() / 1000;
        var elapsed = nowTime - thenTime;
        thenTime = nowTime;
        totalFrameTime += elapsed - (frameHistory[frameIndex] || 0);
        frameHistory[frameIndex] = elapsed;
        frameIndex = (frameIndex + 1) % frameNumber;
        var averageElasped = totalFrameTime / frameNumber;
        return 1 / averageElasped;
    };
}();

function toPowerOf2(n) {
    var ret = 1;
    while (ret <= n) ret *= 2;
    return ret;
}

function gameOfLife() {
    var canvas = document.getElementById("game-of-life");
    /* Init context */
    try {
        gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    } catch(e) {}
    if (!gl) return;
    width = canvas.width;
    height = canvas.height;

    /* Prepare programs */
    calcProgram = getProgram("vshader.glsl", "calc_fshader.glsl");
    if (!calcProgram) return;
    displayProgram = getProgram("vshader.glsl", "display_fshader.glsl");
    if (!displayProgram) return;

    /* Prepare texture */
    textureWidth = toPowerOf2(width) / 1.0;
    textureHeight = toPowerOf2(height) / 1.0;
    textureList.push(generateTexture());
    textureList.push(generateTexture());

    /* Prepare initial data */
    var vertices = [
        1.0,  1.0,  
        -1.0, 1.0,  
        1.0,  -1.0, 
        -1.0, -1.0 
    ];
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    // Init vertices data
    verticesPosition = gl.getAttribLocation(displayProgram, 'vertice_position');
    gl.enableVertexAttribArray(verticesPosition);
    gl.vertexAttribPointer(verticesPosition, 2, gl.FLOAT, false, 0, 0);
    
    gl.activeTexture(gl.TEXTURE0);
    var initImageData = new Uint8Array(textureHeight * textureWidth * 4);
    for (var i = 0; i < initImageData.length; i+=4) {
        initImageData[i+0] = 0;
        initImageData[i+1] = Math.random() > 0.5 ? 255 : 0;
        initImageData[i+2] = 0;
        initImageData[i+3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, textureList[sourceTexture]);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, 
            gl.RGBA, gl.UNSIGNED_BYTE, initImageData);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // Prepare framebuffer
    var frameBuffer = gl.createFramebuffer();

    captureClick(canvas);

    var mainLoop = function() {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        // Calculation program: render-to-texture
        gl.useProgram(calcProgram);
        // Set some parameter
        var cellWidthLocation = gl.getUniformLocation(calcProgram, "cell_width");
        gl.uniform1f(cellWidthLocation, 1.0 / textureWidth);
        var cellHeightLocation = gl.getUniformLocation(calcProgram, "cell_height");
        gl.uniform1f(cellHeightLocation, 1.0 / textureHeight);

        var revive = [-1, -1];
        if (pendingLive.length > 0) {
            pos = pendingLive.pop();
            revive = [pos.x / canvas.width, 1 - pos.y / canvas.height];
        }
        var reviveLocation = gl.getUniformLocation(calcProgram, "revive");
        gl.uniform2f(reviveLocation, revive[0], revive[1]);


        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, 
                gl.TEXTURE_2D, textureList[outputTexture], 0);
        gl.viewport(0, 0, textureWidth, textureHeight);
        gl.bindTexture(gl.TEXTURE_2D, textureList[sourceTexture]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.useProgram(null);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, 
                gl.TEXTURE_2D, null, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        // Display program: render to screen
        gl.useProgram(displayProgram);
        gl.viewport(0, 0, width, height);

        gl.bindTexture(gl.TEXTURE_2D, textureList[outputTexture]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.useProgram(null);

        // Pint-pong texture
        sourceTexture = (sourceTexture + 1) % 2;
        outputTexture = (outputTexture + 1) % 2;
        requestFrame(mainLoop);
    }
    mainLoop();
}

function captureClick(canvas) {
    function relMouseCoords(currentElement, event){
        var totalOffsetX = 0;
        var totalOffsetY = 0;
        var canvasX = 0;
        var canvasY = 0;

        do {
            totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
            totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
        } while(currentElement = currentElement.offsetParent)

        canvasX = event.pageX - totalOffsetX;
        canvasY = event.pageY - totalOffsetY;

        return {x:canvasX, y:canvasY}
    }

    var holding = false;
    canvas.addEventListener('mousedown', function(e) {
        holding = true;
        pos = relMouseCoords(this, e);
        pendingLive.push(pos);
    });

    canvas.addEventListener('mousemove', function(e) {
        if (!holding) return;
        pos = relMouseCoords(this, e);
        console.log(pos);
        pendingLive.push(pos);
    });
    canvas.addEventListener('mouseup', function(e) {
        holding = false;
    });
}

function generateTexture() {
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, textureWidth, textureHeight, 
            0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
}

function getProgram(vshaderPath, fshaderPath) {
    var program = gl.createProgram();
    vshader = getShader(vshaderPath, gl.VERTEX_SHADER);
    fshader = getShader(fshaderPath, gl.FRAGMENT_SHADER);
    if (!vshader || !fshader) return null;

    gl.attachShader(program, vshader);
    gl.attachShader(program, fshader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        alert("Unable to initialize the shader program.");
        return null;
    }
    return program;
}

function getShader(fn, type) {
    shader = gl.createShader(type);
    gl.shaderSource(shader, getShaderSource(fn));
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert("Can't compile shader: " + gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

function getShaderSource(fn) {
    var client = new XMLHttpRequest();
    client.open('GET', fn, false);
    client.send();
    if (client.readyState != 4)
        return null;
    return client.responseText;
}

