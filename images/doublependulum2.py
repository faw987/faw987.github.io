import numpy as np
from scipy.integrate import odeint
import matplotlib.pyplot as plt
import matplotlib.animation as animation

# Parameters
g = 9.81      # Acceleration due to gravity (m/s^2)
l1 = 1.0      # Length of pendulum 1 (meters)
l2 = 1.0      # Length of pendulum 2 (meters)
m1 = 1.0      # Mass of pendulum 1 (kg)
m2 = 1.0      # Mass of pendulum 2 (kg)

# Initial conditions
theta1_0 = np.pi / 2      # Initial angle for pendulum 1 (radians)
theta2_0 = np.pi / 2      # Initial angle for pendulum 2 (radians)
omega1_0 = 0.0            # Initial angular velocity for pendulum 1 (rad/s)
omega2_0 = 0.0            # Initial angular velocity for pendulum 2 (rad/s)

# Time array
t_max = 20                # Duration of the simulation (seconds)
dt = 0.01                 # Time step
t = np.arange(0, t_max, dt)

# Equations of motion
def equations(y, t, m1, m2, l1, l2, g):
    theta1, omega1, theta2, omega2 = y

    delta_theta = theta2 - theta1
    den1 = (m1 + m2)*l1 - m2*l1*np.cos(delta_theta)*np.cos(delta_theta)
    den2 = (l2/l1)*den1

    dtheta1_dt = omega1
    domega1_dt = (m2*l1*omega1*omega1*np.sin(delta_theta)*np.cos(delta_theta) +
                  m2*g*np.sin(theta2)*np.cos(delta_theta) +
                  m2*l2*omega2*omega2*np.sin(delta_theta) -
                  (m1 + m2)*g*np.sin(theta1)) / den1

    dtheta2_dt = omega2
    domega2_dt = (-m2*l2*omega2*omega2*np.sin(delta_theta)*np.cos(delta_theta) +
                  (m1 + m2)*(g*np.sin(theta1)*np.cos(delta_theta) -
                  l1*omega1*omega1*np.sin(delta_theta) - g*np.sin(theta2))) / den2

    return [dtheta1_dt, domega1_dt, dtheta2_dt, domega2_dt]

# Initial state vector
y0 = [theta1_0, omega1_0, theta2_0, omega2_0]

# Integrate the equations of motion
solution = odeint(equations, y0, t, args=(m1, m2, l1, l2, g))
theta1 = solution[:, 0]
theta2 = solution[:, 2]

# Convert to Cartesian coordinates for plotting
x1 = l1 * np.sin(theta1)
y1 = -l1 * np.cos(theta1)

x2 = x1 + l2 * np.sin(theta2)
y2 = y1 - l2 * np.cos(theta2)

# Set up the figure and animation
fig, ax = plt.subplots(figsize=(8, 8))
ax.set_xlim(- (l1 + l2) * 1.1, (l1 + l2) * 1.1)
ax.set_ylim(- (l1 + l2) * 1.1, (l1 + l2) * 1.1)
ax.set_aspect('equal')
ax.grid()

line, = ax.plot([], [], 'o-', lw=2, color='blue')
trace, = ax.plot([], [], '-', lw=1, color='red', alpha=0.5)
time_template = 'time = %.1fs'
time_text = ax.text(0.05, 0.9, '', transform=ax.transAxes)
trace_x, trace_y = [], []

def init():
    line.set_data([], [])
    trace.set_data([], [])
    time_text.set_text('')
    return line, trace, time_text

def animate(i):
    thisx = [0, x1[i], x2[i]]
    thisy = [0, y1[i], y2[i]]

    line.set_data(thisx, thisy)

    trace_x.append(x2[i])
    trace_y.append(y2[i])
    trace.set_data(trace_x, trace_y)

    time_text.set_text(time_template % (i*dt))
    return line, trace, time_text

ani = animation.FuncAnimation(fig, animate, frames=len(t), interval=dt*1000,
                              blit=True, init_func=init)

ani.save('double_pendulum.mp4', writer='ffmpeg', fps=30)

plt.show()