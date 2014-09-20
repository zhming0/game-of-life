#version 100

uniform sampler2D tex;

precision mediump float;
varying float w, h;
varying vec2 xy;
varying vec2 neighbors[8];

uniform vec2 revive;

void main() {
    int count = 0;

    for (int i = 0; i <= 7; i++) {
        if (texture2D(tex, xy + neighbors[i]).g == 1.0)
            count += 1;
        //count += texture2D(tex, xy + neighbors[i]).g;
    }

    float g = texture2D(tex, xy).g;
    if (count == 3 || (g == 1.0 && count == 2) ||
        (abs(xy.x - revive.x) < w * 5.0 && 
         abs(xy.y - revive.y) < h * 5.0))
        gl_FragColor = vec4(0, 1, 0, 1);
    else if (g > 0.0)
        gl_FragColor = vec4(0, g - 0.05, 0, 1);
    else 
        gl_FragColor = vec4(0.1, 0.0, 0.2, 1);
    //gl_FragColor = vec4(0, count == 3 || (g == 1.0 && count == 2), 0, 1);
}
