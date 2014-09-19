#version 100

uniform sampler2D tex;

precision mediump float;
varying vec2 xy;

uniform float cell_width;
uniform float cell_height;
uniform vec2 revive;

void main() {
    int count = 0;
    for (float i = -1.0; i <= 1.0; i += 1.0) 
        for (float j = -1.0; j <= 1.0; j += 1.0) {
            float g = texture2D(tex, 
                    xy + vec2(i * cell_width, 
                        j * cell_height)).g;
            if ((i != 0.0 || j != 0.0) && g == 1.0)
                count++;
        }

    float g = texture2D(tex, xy).g;
    if (count == 3 || (g == 1.0 && count == 2) ||
        (abs(xy.x - revive.x) < cell_width * 5.0 && 
         abs(xy.y - revive.y) < cell_height * 5.0))
        gl_FragColor = vec4(0, 1, 0, 1);
    else if (g > 0.0)
        gl_FragColor = vec4(0, g - 0.05, 0, 1);
    else 
        gl_FragColor = vec4(0.1, 0.0, 0.2, 1);
}
