function GameOfLife(width, height, canvas) {
    /* Private stuff */
    var gl;
    var pendingLive = [];

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
        var frameHistory = [];
        var frameIndex = 0;
        var totalFrameTime= 0;
        var frameNumber = 60;
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

    var getText = function(path) {
        var client = new XMLHttpRequest();
        client.open('GET', path, false); client.send();
        if (client.readyState != 4) return null;
        return client.responseText;
    };

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
            pendingLive.push(pos);
        });
        canvas.addEventListener('mouseup', function(e) {
            holding = false;
        });
        canvas.addEventListener('touchmove', function(e) {
            if (!holding) return;
            pos = relMouseCoords(this, e.touches[0]);
            pendingLive.push(pos);
        }, false);
        canvas.ontouchstart = function(e) {
            holding = true;
            return false;
        }
        canvas.ontouchend = function(e) {
            holding = false;
        }
    }

    var createProgram = function() {
        var getShader = function(src, type) {
            shader = gl.createShader(type);
            gl.shaderSource(shader, src);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                alert("Can't compile shader: " + gl.getShaderInfoLog(shader));
                return null;
            }
            return shader;
        }
        return function(vshader, fshader) {
            var program = gl.createProgram();
            vshader = getShader(vshader, gl.VERTEX_SHADER);
            fshader = getShader(fshader, gl.FRAGMENT_SHADER);
            if (!vshader || !fshader) return null;

            gl.attachShader(program, vshader);
            gl.attachShader(program, fshader);
            gl.linkProgram(program);

            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                alert("Unable to initialize the shader program.");
                return null;
            }
            return program;
        };
    }();

    function Texture(w, h, data) {
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        if (!data) data = null;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 
                0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.bindTexture(gl.TEXTURE_2D, null);
        this.resize = function(width, height) {
        };
    }

    /* Public methods */
    this.width = width;
    this.height = height;
    this.resize = function(width, height) {};
    this.zoom = function(pos, ratio) {};
    this.run = function() {
        captureClick(canvas);
        mainLoop.call(this);
    }

    /* Main logic */
    try {
        gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    } catch(e) {}
    if (!gl) return;
    var calcProgram = createProgram(getText("vshader.glsl"), getText("calc_fshader.glsl"));
    var displayProgram = createProgram(getText("vshader.glsl"), getText("display_fshader.glsl"));

    var initData = new Uint8Array(width * height * 4);
    for (var i = 0; i < initData.length; i+=4) {
        initData[i+1] = Math.random() > 0.5 ? 255 : 0;
        initData[i+3] = 255;
    }
    var sourceTexture = new Texture(width, height, initData);
    var outputTexture = new Texture(width, height);

    /* Prepare initial data */
    var vertices = [
        1.0,  1.0,  
        -1.0, 1.0,  
        1.0,  -1.0, 
        -1.0, -1.0 
    ];
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, 
            new Float32Array(vertices), gl.STATIC_DRAW);
    verticesPosition = gl.getAttribLocation(displayProgram, 
            'vertice_position');
    gl.enableVertexAttribArray(verticesPosition);
    gl.vertexAttribPointer(verticesPosition, 2, 
            gl.FLOAT, false, 0, 0);

    var frameBuffer = gl.createFramebuffer();
    var cellWidthLocation = gl.getUniformLocation(calcProgram, "cell_width");
    var cellHeightLocation = gl.getUniformLocation(calcProgram, "cell_height");
    var reviveLocation = gl.getUniformLocation(calcProgram, "revive");
    gl.activeTexture(gl.TEXTURE0);

    var mainLoop = function() {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        // Calculation program: render-to-texture
        gl.useProgram(calcProgram);
        gl.uniform1f(cellWidthLocation, 1.0 / width);
        gl.uniform1f(cellHeightLocation, 1.0 / height);

        var revive = [-1, -1];
        if (pendingLive.length > 0) {
            pos = pendingLive.shift();
            revive = [pos.x / canvas.width, 1 - pos.y / canvas.height];
        }
        gl.uniform2f(reviveLocation, revive[0], revive[1]);

        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, 
                gl.TEXTURE_2D, outputTexture.texture, 0);
        gl.viewport(0, 0, width, height);
        gl.bindTexture(gl.TEXTURE_2D, sourceTexture.texture);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.useProgram(null);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, 
                gl.TEXTURE_2D, null, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        // Display program: render to screen
        gl.useProgram(displayProgram);
        gl.viewport(0, 0, canvas.width, canvas.height);

        gl.bindTexture(gl.TEXTURE_2D, outputTexture.texture);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.useProgram(null);

        if (this.fpsElement)
            this.fpsElement.innerHTML = getFPS().toFixed(0);

        // Pint-pong texture
        tmp = outputTexture;
        outputTexture = sourceTexture;
        sourceTexture = tmp;
        var that = this;
        requestFrame(function() {
            mainLoop.call(that);
        });
    }
}

