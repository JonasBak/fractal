import {vec3, mat4} from "./gl-matrix";

const canvas = document.getElementById("canvas");

canvas.width = 1000;
canvas.height = 1000;

const gl = canvas.getContext("webgl");

gl.clearColor(1.0, 0.0, 0.0, 1.0);
gl.clear(gl.COLOR_BUFFER_BIT);

const vertexShaderSource = `
    attribute vec4 aVertexPosition;

    void main() {
      gl_Position = aVertexPosition;
    }
  `;

const fragmentShaderSource = `
    precision highp float;

    uniform int time;
    uniform mat4 view;
    uniform vec2 screenSize;

    uniform float epsMarchThr;
    uniform float epsNormalEst;
    uniform float mandelPower;

    const vec3 light_pos = vec3(10.0, 10.0, 10.0);

    #define product(a, b) vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x)
    #define conjugate(a) vec2(a.x,-a.y)
    #define divide(a, b) vec2(((a.x*b.x+a.y*b.y)/(b.x*b.x+b.y*b.y)),((a.y*b.x-a.x*b.y)/(b.x*b.x+b.y*b.y)))

    float mandelbrot(vec2 c) {
      vec2 z = vec2(0.0, 0.0);
      for (int i = 1; i < 100; i++) {
        z = product(z, z) + c;

        if (length(z) > 100.0) {
          return 1.0 / pow(float(i), 0.5);
        }
        
      }
      return 0.0;
    }

    float mandelblub_distance(vec3 pos) {
      vec3 z = pos;
      float dr = 1.0;
      float r = 0.0;
      for (int i = 0; i < 500 ; i++) {
        r = length(z);
        if (r>10.0) break;
        
        // convert to polar coordinates
        float theta = acos(z.z/r);
        float phi = atan(z.y,z.x);
        dr =  pow( r, mandelPower-1.0)*mandelPower*dr + 1.0;
        
        // scale and rotate the point
        float zr = pow( r,mandelPower);
        theta = theta*mandelPower;
        phi = phi*mandelPower;
        
        // convert back to cartesian coordinates
        z = zr*vec3(sin(theta)*cos(phi), sin(phi)*sin(theta), cos(theta));
        z+=pos;
      }
      return 0.5*log(r)*r/dr;
    }

    float dist_estimate(vec3 point) {
      return mandelblub_distance(point);
    }

    vec3 estimateNormal(vec3 p) {
        return normalize(vec3(
            dist_estimate(vec3(p.x + epsNormalEst, p.y, p.z)) - dist_estimate(vec3(p.x - epsNormalEst, p.y, p.z)),
            dist_estimate(vec3(p.x, p.y + epsNormalEst, p.z)) - dist_estimate(vec3(p.x, p.y - epsNormalEst, p.z)),
            dist_estimate(vec3(p.x, p.y, p.z  + epsNormalEst)) - dist_estimate(vec3(p.x, p.y, p.z - epsNormalEst))
        ));
    }

    vec3 march(vec3 point, vec3 direction) {
      float dist = 0.0;
      float min_dist = 200.0;
      const int maxSteps = 100;
      for (int i = 0; i < maxSteps; i++) {
        vec3 p = (view * vec4(point + dist * direction, 1.0)).xyz;
        float estimate = dist_estimate(p);

        if (estimate < min_dist) {
          min_dist = estimate;
        }

        if (estimate < epsMarchThr) {
          vec3 normal = estimateNormal(p);
          float specular = dot(normalize(light_pos - p), normal);
          float occlution = pow(float(i) / 80.0, 1.5);
          float steps = 10.0 / float(i);

          float t = 1.0 - float(i) / float(maxSteps);
          return vec3(t);
        }

        dist += estimate;

        if (dist > 20.0) {
          return vec3(0.0, 0.0, 1.0 / pow(min_dist * 100.0 + 2.0, 0.5));
        }
      }
      return vec3(0.0);
    }


    void main() {
      float scale = min(screenSize.x, screenSize.y);

      vec3 direction = normalize(vec3(gl_FragCoord.xy - 0.5 * screenSize, scale));

      vec3 t = march(vec3(0.0), direction);

      vec3 color = vec3(1.0, 1.0, 1.0) * t;
      //vec3 color = vec3(1.0, 1.0, 1.0) * mandelbrot((gl_FragCoord.xy - vec2(250.0, 250.0)) / vec2(120.0, 120.0));

      gl_FragColor = vec4(color, 1.0);
    }
  `;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function linkShaderProgram(gl, vertexShaderSource, fragmentShaderSource) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }
  return shaderProgram;
}

const getShaderProgram = (gl, vertexShaderSource, fragmentShaderSource) => {
  const shaderProgram = linkShaderProgram(gl, vertexShaderSource, fragmentShaderSource);

  return {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
    },
    uniformLocations: {
      time: gl.getUniformLocation(shaderProgram, 'time'),
      view: gl.getUniformLocation(shaderProgram, 'view'),
      screenSize: gl.getUniformLocation(shaderProgram, 'screenSize'),
      epsMarchThr: gl.getUniformLocation(shaderProgram, 'epsMarchThr'),
      epsNormalEst: gl.getUniformLocation(shaderProgram, 'epsNormalEst'),
      mandelPower: gl.getUniformLocation(shaderProgram, 'mandelPower'),
    },
  };
}

const getRender = () => {
  let view = mat4.identity(mat4.create());
  mat4.rotateY(view, view, -0.7);
  mat4.rotateX(view, view, 0.3);
  mat4.translate(view, view, vec3.fromValues(-1.0, 0.0, -4.0));
  return {
    view,
    epsMarchThr: 0.005,
    epsNormalEst: 0.0004,
    mandelPower: 6.0,
    update: (t, render) => ({...render, mandelPower: 6.0 + 4 * Math.sin(t / 5000)}),
    animate: true,
  };
}

const initBuffers = gl => {

  const positionBuffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  const positions = [
    -1.0,  1.0,
     1.0,  1.0,
    -1.0, -1.0,
     1.0, -1.0,
  ];

  gl.bufferData(gl.ARRAY_BUFFER,
                new Float32Array(positions),
                gl.STATIC_DRAW);

  return {
    position: positionBuffer,
  };
};

const bufferPositions = (gl, buffers, programInfo) => {
  {
    const numComponents = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexPosition,
      numComponents,
      type,
      normalize,
      stride,
      offset);
    gl.enableVertexAttribArray(
      programInfo.attribLocations.vertexPosition);
  }
}

function drawScene(gl, programInfo, render) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clearDepth(1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


  gl.useProgram(programInfo.program);

  gl.uniform1i(
    programInfo.uniformLocations.time,
    new Date().getTime() - startTime
  );
  gl.uniform2f(
    programInfo.uniformLocations.screenSize,
    canvas.width,
    canvas.height
  );
  gl.uniformMatrix4fv(
    programInfo.uniformLocations.view,
    false,
    render.view
  );
  gl.uniform1f(
    programInfo.uniformLocations.epsMarchThr,
    render.epsMarchThr
  );
  gl.uniform1f(
    programInfo.uniformLocations.epsNormalEst,
    render.epsNormalEst
  );
  gl.uniform1f(
    programInfo.uniformLocations.mandelPower,
    render.mandelPower
  );

  {
    const offset = 0;
    const vertexCount = 4;
    gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
  }

  if (render.animate) 
    requestAnimationFrame(
      () => drawScene(gl, programInfo, render.update(new Date().getTime() - startTime, render))
    );
}

const programInfo = getShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
const buffers = initBuffers(gl);
const startTime = new Date().getTime();
const render = getRender();

bufferPositions(gl, buffers, programInfo);

drawScene(gl, programInfo, render);
