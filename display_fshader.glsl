#version 100

uniform sampler2D tex;

precision mediump float;
varying vec2 xy;

void main() {
    gl_FragColor = texture2D(tex, xy);
}
