"""UDP client for DroneWiFiTelemetry flight control, monitoring and calibration."""

from __future__ import annotations

from dataclasses import dataclass, replace
import socket
import threading
import time
from typing import Callable, Optional

PID_FIELD_COUNT = 15
ALT_PID_FIELD_COUNT = 4
ALL_PID_FIELD_COUNT = PID_FIELD_COUNT + ALT_PID_FIELD_COUNT
CAL_VALUE_COUNT = 8


@dataclass(frozen=True)
class ControlChannels:
    roll: int = 1500
    pitch: int = 1500
    throttle: int = 1000
    yaw: int = 1500
    arm: int = 1000
    flight_mode: int = 1000

    def clamped(self) -> "ControlChannels":
        def limit(value: int) -> int: return max(1000, min(2000, int(value)))
        return ControlChannels(limit(self.roll), limit(self.pitch), limit(self.throttle), limit(self.yaw), limit(self.arm), limit(self.flight_mode))

    def as_tuple(self) -> tuple[int, int, int, int, int, int]:
        v = self.clamped(); return v.roll, v.pitch, v.throttle, v.yaw, v.arm, v.flight_mode

    def to_packet(self) -> str: return ",".join(str(v) for v in self.as_tuple())


@dataclass(frozen=True)
class TelemetryData:
    esp_time_ms: int = 0
    rate_roll: float = 0.0
    rate_pitch: float = 0.0
    rate_yaw: float = 0.0
    acc_x: float = 0.0
    acc_y: float = 0.0
    acc_z: float = 0.0
    angle_roll: float = 0.0
    angle_pitch: float = 0.0
    flight_roll: float = 0.0
    flight_pitch: float = 0.0
    flight_angles_valid: bool = False
    received_monotonic: float = 0.0


@dataclass(frozen=True)
class AltitudeData:
    esp_time_ms: int = 0
    mode: int = 0
    baro_altitude: float = 0.0
    kalman_altitude: float = 0.0
    vertical_velocity: float = 0.0
    acc_z_inertial: float = 0.0
    desired_vertical_velocity: float = 0.0
    target_altitude: float = 0.0
    base_throttle: float = 1500.0
    input_throttle: float = 1500.0
    vertical_pid_output: float = 0.0
    baro_healthy: bool = False
    ground_tracking: bool = False
    received_monotonic: float = 0.0


@dataclass(frozen=True)
class ControlDiagnostics:
    esp_time_ms: int = 0
    mode: int = 0
    ch_roll: int = 1500
    ch_pitch: int = 1500
    ch_throttle: int = 1000
    ch_yaw: int = 1500
    ch_arm: int = 1000
    ch_flight_mode: int = 1000
    armed: bool = False
    control_valid: bool = False
    failsafe: bool = True
    stop_reason: int = 0
    imu_fail_count: int = 0
    control_age_ms: int = 0
    raw_acc_x: float = 0.0
    raw_acc_y: float = 0.0
    raw_acc_z: float = 0.0
    acc_x: float = 0.0
    acc_y: float = 0.0
    acc_z: float = 0.0
    acc_magnitude: float = 0.0
    desired_angle_roll: float = 0.0
    desired_angle_pitch: float = 0.0
    accel_angle_roll: float = 0.0
    accel_angle_pitch: float = 0.0
    kalman_roll: float = 0.0
    kalman_pitch: float = 0.0
    flight_roll: float = 0.0
    flight_pitch: float = 0.0
    angle_error_roll: float = 0.0
    angle_error_pitch: float = 0.0
    desired_rate_roll: float = 0.0
    desired_rate_pitch: float = 0.0
    desired_rate_yaw: float = 0.0
    rate_roll: float = 0.0
    rate_pitch: float = 0.0
    rate_yaw: float = 0.0
    rate_error_roll: float = 0.0
    rate_error_pitch: float = 0.0
    rate_error_yaw: float = 0.0
    pid_output_roll: float = 0.0
    pid_output_pitch: float = 0.0
    pid_output_yaw: float = 0.0
    angle_p_roll: float = 0.0
    angle_i_roll: float = 0.0
    angle_d_roll: float = 0.0
    angle_p_pitch: float = 0.0
    angle_i_pitch: float = 0.0
    angle_d_pitch: float = 0.0
    rate_p_roll: float = 0.0
    rate_i_roll: float = 0.0
    rate_d_roll: float = 0.0
    rate_p_pitch: float = 0.0
    rate_i_pitch: float = 0.0
    rate_d_pitch: float = 0.0
    rate_p_yaw: float = 0.0
    rate_i_yaw: float = 0.0
    rate_d_yaw: float = 0.0
    accel_trust_roll: float = 1.0
    accel_trust_pitch: float = 1.0
    effective_kalman_r_roll: float = 3.0
    effective_kalman_r_pitch: float = 3.0
    accel_rejected_roll: bool = False
    accel_rejected_pitch: bool = False
    rate_i_enabled: bool = False
    anti_windup_active: bool = False
    motor_saturated_low: bool = False
    motor_saturated_high: bool = False
    motor1: int = 1024
    motor2: int = 1024
    motor3: int = 1024
    motor4: int = 1024
    gyro_bias_roll: float = 0.0
    gyro_bias_pitch: float = 0.0
    gyro_bias_yaw: float = 0.0
    imu_error_count: int = 0
    received_monotonic: float = 0.0


@dataclass(frozen=True)
class DiagnosticConfig:
    firmware_major: int = 2
    firmware_minor: int = 1
    firmware_patch: int = 0
    loop_period_us: int = 4000
    imu_i2c_speed: int = 400000
    telemetry_interval_ms: int = 50
    status_interval_ms: int = 200
    failsafe_timeout_ms: int = 300
    imu_fail_limit: int = 5
    angle_stick_scale: float = 0.10
    rate_stick_scale: float = 0.15
    max_angle_rate: float = 150.0
    kalman_process_noise: float = 4.0
    kalman_measurement_noise: float = 3.0
    kalman_flight_measurement_noise: float = 6.0
    kalman_initial_uncertainty: float = 4.0
    acc_trust_full_mag_error: float = 0.08
    acc_trust_reject_mag_error: float = 0.30
    acc_trust_full_innovation: float = 8.0
    acc_trust_reject_innovation: float = 25.0
    pid_i_enable_throttle: float = 1250.0
    rate_i_limit: float = 120.0
    angle_i_limit: float = 30.0
    pid_output_limit: float = 400.0
    throttle_max_us: float = 1800.0
    pwm_scale: float = 1.024
    pwm_freq: int = 250
    pwm_resolution: int = 12
    motor_stop_duty: int = 1024
    motor_idle_duty: int = 1208
    motor_max_duty: int = 2047
    esc_min_duty: int = 1024
    esc_max_duty: int = 2048
    acc_cal_samples: int = 400
    level_cal_samples: int = 400
    cal_still_rate_limit: float = 5.0
    imu_address: int = 0x6A
    imu_ctrl1_xl: int = 0x7E
    imu_ctrl2_g: int = 0x78
    imu_ctrl6_c: int = 0x07
    imu_ctrl8_xl: int = 0x80
    imu_acc_sensitivity: float = 0.000244
    imu_gyro_sensitivity: float = 0.035
    received_monotonic: float = 0.0

    @property
    def firmware_version(self) -> str: return f"{self.firmware_major}.{self.firmware_minor}.{self.firmware_patch}"


@dataclass(frozen=True)
class StatusData:
    esp_time_ms: int = 0
    armed: bool = False
    control_valid: bool = False
    failsafe: bool = True
    control_age_ms: int = 0
    imu_fail_count: int = 0
    loop_overruns: int = 0
    stop_reason: int = 0
    throttle: int = 1000
    motor1: int = 1024
    motor2: int = 1024
    motor3: int = 1024
    motor4: int = 1024
    received_monotonic: float = 0.0


@dataclass(frozen=True)
class EventData:
    esp_time_ms: int
    level: str
    code: str
    value: int
    received_monotonic: float = 0.0


@dataclass(frozen=True)
class TxDiagnostics:
    total_control_packets: int = 0
    last_gap_ms: float = 0.0
    max_gap_ms: float = 0.0
    send_errors: int = 0


@dataclass(frozen=True)
class PIDValues:
    # Display fallback only. GUI Apply/Save stays disabled until PIDVAL arrives.
    p_rate_roll: float = 0.9
    p_rate_pitch: float = 0.9
    p_rate_yaw: float = 3.0
    i_rate_roll: float = 15.0
    i_rate_pitch: float = 15.0
    i_rate_yaw: float = 13.0
    d_rate_roll: float = 0.035
    d_rate_pitch: float = 0.035
    d_rate_yaw: float = 0.0
    p_angle_roll: float = 3.0
    p_angle_pitch: float = 3.0
    i_angle_roll: float = 0.0
    i_angle_pitch: float = 0.0
    d_angle_roll: float = 0.0
    d_angle_pitch: float = 0.0

    def as_tuple(self) -> tuple[float, ...]:
        return (self.p_rate_roll,self.p_rate_pitch,self.p_rate_yaw,self.i_rate_roll,self.i_rate_pitch,self.i_rate_yaw,
                self.d_rate_roll,self.d_rate_pitch,self.d_rate_yaw,self.p_angle_roll,self.p_angle_pitch,
                self.i_angle_roll,self.i_angle_pitch,self.d_angle_roll,self.d_angle_pitch)

    @classmethod
    def from_values(cls, values: list[float] | tuple[float, ...]) -> "PIDValues":
        if len(values) != PID_FIELD_COUNT: raise ValueError(f"Expected {PID_FIELD_COUNT} PID values, received {len(values)}")
        return cls(*[float(value) for value in values])

    def validate(self) -> None:
        proportional=(self.p_rate_roll,self.p_rate_pitch,self.p_rate_yaw,self.p_angle_roll,self.p_angle_pitch)
        integral=(self.i_rate_roll,self.i_rate_pitch,self.i_rate_yaw,self.i_angle_roll,self.i_angle_pitch)
        derivative=(self.d_rate_roll,self.d_rate_pitch,self.d_rate_yaw,self.d_angle_roll,self.d_angle_pitch)
        if any(v < 0.0 or v > 100.0 for v in proportional): raise ValueError("P values must be between 0 and 100")
        if any(v < 0.0 or v > 500.0 for v in integral): raise ValueError("I values must be between 0 and 500")
        if any(v < 0.0 or v > 20.0 for v in derivative): raise ValueError("D values must be between 0 and 20")

    def to_packet_values(self) -> str: self.validate(); return ",".join(f"{v:.8g}" for v in self.as_tuple())


@dataclass(frozen=True)
class AltitudePIDValues:
    p_velocity_vertical: float = 4.5
    i_velocity_vertical: float = 0.0
    d_velocity_vertical: float = 0.0
    p_altitude: float = 1.0

    def as_tuple(self) -> tuple[float, ...]: return (self.p_velocity_vertical,self.i_velocity_vertical,self.d_velocity_vertical,self.p_altitude)
    @classmethod
    def from_values(cls, values):
        if len(values)!=ALT_PID_FIELD_COUNT: raise ValueError(f"Expected {ALT_PID_FIELD_COUNT} altitude PID values, received {len(values)}")
        return cls(*[float(v) for v in values])
    def validate(self) -> None:
        if not 0 <= self.p_velocity_vertical <= 50: raise ValueError("Velocity P must be 0..50")
        if not 0 <= self.i_velocity_vertical <= 100: raise ValueError("Velocity I must be 0..100")
        if not 0 <= self.d_velocity_vertical <= 20: raise ValueError("Velocity D must be 0..20")
        if not 0 <= self.p_altitude <= 10: raise ValueError("Altitude P must be 0..10")
    def to_packet_values(self) -> str: self.validate(); return ",".join(f"{v:.8g}" for v in self.as_tuple())


@dataclass(frozen=True)
class CalibrationValues:
    accel_offset_x: float = 0.0
    accel_offset_y: float = 0.0
    accel_offset_z: float = 0.0
    accel_scale_x: float = 1.0
    accel_scale_y: float = 1.0
    accel_scale_z: float = 1.0
    level_trim_roll: float = 0.0
    level_trim_pitch: float = 0.0
    received_monotonic: float = 0.0

    @classmethod
    def from_values(cls, values: list[float] | tuple[float, ...]) -> "CalibrationValues":
        if len(values) != CAL_VALUE_COUNT: raise ValueError(f"Expected {CAL_VALUE_COUNT} calibration values, received {len(values)}")
        return cls(*[float(value) for value in values], received_monotonic=time.monotonic())


@dataclass(frozen=True)
class CalibrationStatus:
    accel_calibrated: bool = False
    level_calibrated: bool = False
    saved_in_nvs: bool = False
    received_monotonic: float = 0.0


@dataclass(frozen=True)
class CalibrationEvent:
    kind: str
    action: str
    detail: str = ""
    position: str = ""
    completed: int = 0
    total: int = 0
    received_monotonic: float = 0.0


@dataclass(frozen=True)
class ESCStatus:
    scheduled: bool = False
    last_result: int = 0
    received_monotonic: float = 0.0


@dataclass(frozen=True)
class ESCEvent:
    kind: str
    action: str
    detail: str = ""
    phase: str = ""
    percent: int = 0
    received_monotonic: float = 0.0


@dataclass(frozen=True)
class TrimValues:
    roll: float = 0.0
    pitch: float = 0.0
    saved: bool = False
    received_monotonic: float = 0.0


@dataclass(frozen=True)
class TrimEvent:
    kind: str
    action: str
    detail: str = ""
    received_monotonic: float = 0.0


TelemetryCallback = Callable[[TelemetryData], None]
AltitudeCallback = Callable[[AltitudeData], None]
DiagnosticsCallback = Callable[[ControlDiagnostics], None]
DiagnosticConfigCallback = Callable[[DiagnosticConfig], None]
StatusCallback = Callable[[StatusData], None]
EventCallback = Callable[[EventData], None]
PIDCallback = Callable[[PIDValues], None]
AltitudePIDCallback = Callable[[AltitudePIDValues], None]
ModeCallback = Callable[[int], None]
CalibrationValuesCallback = Callable[[CalibrationValues], None]
CalibrationStatusCallback = Callable[[CalibrationStatus], None]
CalibrationEventCallback = Callable[[CalibrationEvent], None]
ESCStatusCallback = Callable[[ESCStatus], None]
ESCEventCallback = Callable[[ESCEvent], None]
TrimValuesCallback = Callable[[TrimValues], None]
TrimEventCallback = Callable[[TrimEvent], None]
TextCallback = Callable[[str], None]


class DroneWiFiClient:
    """Threaded UDP client with 50 Hz control, telemetry/PID and calibration protocol."""

    def __init__(self, drone_ip: str="192.168.4.1", drone_port: int=8080, control_rate_hz: float=50.0, local_port: int=0) -> None:
        if control_rate_hz <= 0.0 or control_rate_hz > 100.0: raise ValueError("control_rate_hz must be greater than 0 and at most 100 Hz")
        self.drone_address=(drone_ip,int(drone_port)); self.control_rate_hz=float(control_rate_hz); self.local_port=int(local_port)
        self._socket: Optional[socket.socket]=None; self._running=threading.Event(); self._send_control_enabled=threading.Event(); self._lock=threading.RLock()
        self._rx_thread: Optional[threading.Thread]=None; self._control_thread: Optional[threading.Thread]=None; self._heartbeat_thread: Optional[threading.Thread]=None
        self._channels=ControlChannels(); self._telemetry: Optional[TelemetryData]=None; self._diagnostics: Optional[ControlDiagnostics]=None; self._diagnostic_config: Optional[DiagnosticConfig]=None; self._status: Optional[StatusData]=None; self._altitude: Optional[AltitudeData]=None; self._pid: Optional[PIDValues]=None; self._altitude_pid: Optional[AltitudePIDValues]=None; self._saved_mode:int=1000; self._calibration: Optional[CalibrationValues]=None; self._calibration_status: Optional[CalibrationStatus]=None; self._esc_status: Optional[ESCStatus]=None; self._trim: Optional[TrimValues]=None
        self._last_rx_monotonic=0.0; self._last_ack=""; self._last_error=""; self._tx_total=0; self._tx_last_gap_ms=0.0; self._tx_max_gap_ms=0.0; self._tx_send_errors=0
        self.on_telemetry: Optional[TelemetryCallback]=None; self.on_altitude: Optional[AltitudeCallback]=None; self.on_diagnostics: Optional[DiagnosticsCallback]=None; self.on_diagnostic_config: Optional[DiagnosticConfigCallback]=None; self.on_status: Optional[StatusCallback]=None; self.on_event: Optional[EventCallback]=None; self.on_pid: Optional[PIDCallback]=None; self.on_altitude_pid: Optional[AltitudePIDCallback]=None; self.on_saved_mode: Optional[ModeCallback]=None
        self.on_calibration_values: Optional[CalibrationValuesCallback]=None; self.on_calibration_status: Optional[CalibrationStatusCallback]=None; self.on_calibration_event: Optional[CalibrationEventCallback]=None; self.on_esc_status: Optional[ESCStatusCallback]=None; self.on_esc_event: Optional[ESCEventCallback]=None; self.on_trim_values: Optional[TrimValuesCallback]=None; self.on_trim_event: Optional[TrimEventCallback]=None; self.on_text: Optional[TextCallback]=None

    def start(self, send_control: bool=True) -> None:
        if self._running.is_set():
            if send_control: self._send_control_enabled.set()
            return
        sock=socket.socket(socket.AF_INET,socket.SOCK_DGRAM); sock.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1); sock.bind(("0.0.0.0",self.local_port)); sock.settimeout(0.20)
        self._socket=sock; self._running.set(); self._send_control_enabled.set() if send_control else self._send_control_enabled.clear()
        self._rx_thread=threading.Thread(target=self._receiver_loop,name="DroneWiFiRX",daemon=True); self._control_thread=threading.Thread(target=self._control_loop,name="DroneWiFiTX",daemon=True); self._heartbeat_thread=threading.Thread(target=self._heartbeat_loop,name="DroneWiFiHeartbeat",daemon=True)
        self._rx_thread.start(); self._control_thread.start(); self._heartbeat_thread.start()
        # Keep startup control streaming independent from the first parameter burst.
        self.send_channels_now(repeats=3,spacing_s=0.004)
        threading.Thread(target=self._startup_queries,name="DroneWiFiStartupQueries",daemon=True).start()

    def _startup_queries(self) -> None:
        time.sleep(0.20)
        if not self._running.is_set(): return
        self.ping(); self.request_diagnostic_config(); self.request_all_pid(); self.request_saved_mode(); self.request_calibration(); self.request_esc_status(); self.request_trim()

    def close(self, send_safe_values: bool=True) -> None:
        if send_safe_values and self._socket is not None:
            self.set_safe_channels(); safe=self.get_channels().to_packet()
            for _ in range(3): self._send_text(safe,suppress_errors=True,count_control=False); time.sleep(0.01)
        self._send_control_enabled.clear(); self._running.clear(); sock=self._socket; self._socket=None
        if sock is not None:
            try: sock.close()
            except OSError: pass
        for thread in (self._rx_thread,self._control_thread,self._heartbeat_thread):
            if thread is not None and thread.is_alive(): thread.join(timeout=0.5)

    @property
    def connected(self) -> bool:
        with self._lock: last=self._last_rx_monotonic
        return last > 0.0 and (time.monotonic()-last) <= 2.5
    @property
    def last_packet_age(self) -> float:
        with self._lock: last=self._last_rx_monotonic
        return float("inf") if last == 0.0 else time.monotonic()-last
    @property
    def last_ack(self) -> str:
        with self._lock: return self._last_ack
    @property
    def last_error(self) -> str:
        with self._lock: return self._last_error
    @property
    def pid_received(self) -> bool:
        with self._lock: return self._pid is not None
    @property
    def calibration_received(self) -> bool:
        with self._lock: return self._calibration is not None

    def clear_error(self) -> None:
        with self._lock: self._last_error=""
    def enable_control_stream(self, enabled: bool=True) -> None: self._send_control_enabled.set() if enabled else self._send_control_enabled.clear()
    def set_channels(self, channels: ControlChannels) -> None:
        with self._lock: self._channels=channels.clamped()
    def update_channels(self, **changes: int) -> ControlChannels:
        allowed={"roll","pitch","throttle","yaw","arm","flight_mode"}; unknown=set(changes)-allowed
        if unknown: raise ValueError(f"Unknown channel names: {sorted(unknown)}")
        with self._lock: self._channels=replace(self._channels,**changes).clamped(); return self._channels
    def get_channels(self) -> ControlChannels:
        with self._lock: return self._channels
    def set_safe_channels(self) -> None: self.set_channels(ControlChannels())
    def send_channels_now(self, repeats: int=1, spacing_s: float=0.0) -> None:
        repeats=max(1,min(10,int(repeats))); spacing_s=max(0.0,min(0.05,float(spacing_s)))
        for index in range(repeats):
            self._send_text(self.get_channels().to_packet(),suppress_errors=True,count_control=True)
            if spacing_s > 0.0 and index+1 < repeats: time.sleep(spacing_s)

    def get_telemetry(self) -> Optional[TelemetryData]:
        with self._lock: return self._telemetry
    def get_diagnostics(self) -> Optional[ControlDiagnostics]:
        with self._lock: return self._diagnostics
    def get_diagnostic_config(self) -> Optional[DiagnosticConfig]:
        with self._lock: return self._diagnostic_config
    def get_status(self) -> Optional[StatusData]:
        with self._lock: return self._status
    def get_pid(self) -> Optional[PIDValues]:
        with self._lock: return self._pid
    def get_altitude(self) -> Optional[AltitudeData]:
        with self._lock: return self._altitude
    def get_altitude_pid(self) -> Optional[AltitudePIDValues]:
        with self._lock: return self._altitude_pid
    def get_saved_mode(self) -> int:
        with self._lock: return self._saved_mode
    def get_calibration(self) -> Optional[CalibrationValues]:
        with self._lock: return self._calibration
    def get_calibration_status(self) -> Optional[CalibrationStatus]:
        with self._lock: return self._calibration_status
    def get_esc_status(self) -> Optional[ESCStatus]:
        with self._lock: return self._esc_status
    def get_trim(self) -> Optional[TrimValues]:
        with self._lock: return self._trim
    def get_tx_diagnostics(self) -> TxDiagnostics:
        with self._lock: return TxDiagnostics(self._tx_total,self._tx_last_gap_ms,self._tx_max_gap_ms,self._tx_send_errors)

    def ping(self) -> None: self._send_text("PING",suppress_errors=True,count_control=False)
    def request_diagnostic_config(self) -> None: self._send_text("DIAGGET",suppress_errors=True,count_control=False)
    def request_pid(self) -> None: self._send_text("PIDGET",suppress_errors=True,count_control=False)
    def apply_pid(self, pid: PIDValues) -> None: self._send_text("PIDSET,"+pid.to_packet_values(),count_control=False)
    def save_pid(self, pid: PIDValues) -> None: self._send_text("PIDSAVE,"+pid.to_packet_values(),count_control=False)
    def request_altitude_pid(self) -> None: self._send_text("ALTPIDGET",suppress_errors=True,count_control=False)
    def apply_altitude_pid(self, pid: AltitudePIDValues) -> None: self._send_text("ALTPIDSET,"+pid.to_packet_values(),count_control=False)
    def save_altitude_pid(self, pid: AltitudePIDValues) -> None: self._send_text("ALTPIDSAVE,"+pid.to_packet_values(),count_control=False)
    def request_all_pid(self) -> None: self._send_text("PIDALLGET",suppress_errors=True,count_control=False)
    def apply_all_pid(self, pid: PIDValues, altitude_pid: AltitudePIDValues) -> None:
        self._send_text("PIDALLSET,"+pid.to_packet_values()+","+altitude_pid.to_packet_values(),count_control=False)
    def save_all_pid(self, pid: PIDValues, altitude_pid: AltitudePIDValues) -> None:
        self._send_text("PIDALLSAVE,"+pid.to_packet_values()+","+altitude_pid.to_packet_values(),count_control=False)
    def request_saved_mode(self) -> None: self._send_text("MODEGET",suppress_errors=True,count_control=False)
    def save_mode(self, mode_value: int) -> None:
        mode_value=int(mode_value)
        if mode_value not in {1000,1333,1667,2000}: raise ValueError("Invalid flight mode")
        self._send_text(f"MODESAVE,{mode_value}",count_control=False)

    # Calibration commands.
    def request_calibration(self) -> None: self._send_text("CAL,GET",suppress_errors=True,count_control=False)
    def imu_test(self) -> None: self._send_text("CAL,IMU_TEST",count_control=False)
    def calibrate_gyro(self) -> None: self._send_text("CAL,GYRO",count_control=False)
    def calibrate_level(self) -> None: self._send_text("CAL,LEVEL",count_control=False)
    def reset_calibration(self) -> None: self._send_text("CAL,RESET",count_control=False)
    def accel_calibration_start(self) -> None: self._send_text("CAL,ACC,START",count_control=False)
    def accel_calibration_capture(self, position: str) -> None:
        position=str(position).strip().upper(); allowed={"LEVEL","RIGHT","LEFT","NOSE_DOWN","NOSE_UP","UPSIDE_DOWN"}
        if position not in allowed: raise ValueError(f"Unknown accelerometer position: {position}")
        self._send_text(f"CAL,ACC,CAPTURE,{position}",count_control=False)
    def accel_calibration_cancel(self) -> None: self._send_text("CAL,ACC,CANCEL",count_control=False)

    # ESC endpoint calibration is scheduled for the next power-on.
    def request_esc_status(self) -> None: self._send_text("ESC,GET",suppress_errors=True,count_control=False)
    def schedule_esc_calibration(self) -> None: self._send_text("ESC,SCHEDULE",count_control=False)
    def cancel_esc_calibration(self) -> None: self._send_text("ESC,CANCEL",count_control=False)

    # Flight trim. Runtime APPLY is bounded by the FC; SAVE/RESET require disarmed safe state.
    def request_trim(self) -> None: self._send_text("TRIM,GET",suppress_errors=True,count_control=False)
    def apply_trim(self, roll: float, pitch: float) -> None: self._send_text(f"TRIM,APPLY,{float(roll):.4f},{float(pitch):.4f}",count_control=False)
    def save_trim(self, roll: float, pitch: float) -> None: self._send_text(f"TRIM,SAVE,{float(roll):.4f},{float(pitch):.4f}",count_control=False)
    def reset_trim(self) -> None: self._send_text("TRIM,RESET",count_control=False)

    def save_accel_offsets(self, x: float, y: float, z: float) -> None:
        self._send_text(f"CAL,OFFSET,{float(x):.7f},{float(y):.7f},{float(z):.7f}",count_control=False)

    def _send_text(self, text: str, suppress_errors: bool=False, count_control: bool=False) -> bool:
        sock=self._socket
        if sock is None:
            if suppress_errors: return False
            raise RuntimeError("DroneWiFiClient.start() must be called first")
        try:
            sock.sendto(text.encode("ascii"),self.drone_address)
            if count_control:
                with self._lock: self._tx_total += 1
            return True
        except OSError as exc:
            with self._lock:
                self._last_error=f"UDP send error: {exc}"
                if count_control: self._tx_send_errors += 1
            if not suppress_errors: raise
            return False

    def _control_loop(self) -> None:
        period=1.0/self.control_rate_hz; next_send=time.monotonic(); previous_send: Optional[float]=None
        while self._running.is_set():
            if not self._send_control_enabled.is_set(): time.sleep(0.01); next_send=time.monotonic(); previous_send=None; continue
            now=time.monotonic()
            if now < next_send: time.sleep(min(next_send-now,0.005)); continue
            if previous_send is not None:
                gap_ms=(now-previous_send)*1000.0
                with self._lock:
                    self._tx_last_gap_ms=gap_ms
                    if gap_ms > self._tx_max_gap_ms: self._tx_max_gap_ms=gap_ms
            previous_send=now; self._send_text(self.get_channels().to_packet(),suppress_errors=True,count_control=True); next_send += period
            if next_send < now-period: next_send=now+period

    def _heartbeat_loop(self) -> None:
        while self._running.is_set():
            self.ping()
            for _ in range(10):
                if not self._running.is_set(): return
                time.sleep(0.1)

    def _receiver_loop(self) -> None:
        while self._running.is_set():
            sock=self._socket
            if sock is None: return
            try: data,_=sock.recvfrom(2048)
            except socket.timeout: continue
            except OSError: return
            text=data.decode("utf-8",errors="replace").strip()
            if not text: continue
            with self._lock:
                self._last_rx_monotonic=time.monotonic()
                if self._last_error.startswith("UDP"): self._last_error=""
            self._handle_packet(text)

    def _handle_packet(self, text: str) -> None:
        parts=text.split(","); packet_type=parts[0].strip().upper() if parts else ""
        try:
            if packet_type == "TEL" and len(parts) in (10,12):
                values=[float(x) for x in parts[2:]]
                if len(parts)==10:
                    rate_roll,rate_pitch,rate_yaw,acc_x,acc_y,acc_z,kalman_roll,kalman_pitch=values
                    flight_roll,flight_pitch,flight_valid=kalman_roll,kalman_pitch,False
                else:
                    rate_roll,rate_pitch,rate_yaw,acc_x,acc_y,acc_z,kalman_roll,kalman_pitch,flight_roll,flight_pitch=values; flight_valid=True
                item=TelemetryData(int(parts[1]),rate_roll,rate_pitch,rate_yaw,acc_x,acc_y,acc_z,kalman_roll,kalman_pitch,flight_roll,flight_pitch,flight_valid,time.monotonic())
                with self._lock: self._telemetry=item
                if self.on_telemetry: self.on_telemetry(item)
                return
            if packet_type == "DBG" and len(parts) == 23:
                # v1.8 compatibility: fill the original Roll/Pitch chain; extended fields use defaults.
                v=[float(x) for x in parts[5:]]
                item=ControlDiagnostics(esp_time_ms=int(parts[1]),mode=int(parts[2]),ch_roll=int(parts[3]),ch_pitch=int(parts[4]),
                    desired_angle_roll=v[0],desired_angle_pitch=v[1],accel_angle_roll=v[2],accel_angle_pitch=v[3],kalman_roll=v[4],kalman_pitch=v[5],flight_roll=v[6],flight_pitch=v[7],angle_error_roll=v[8],angle_error_pitch=v[9],desired_rate_roll=v[10],desired_rate_pitch=v[11],rate_roll=v[12],rate_pitch=v[13],rate_error_roll=v[14],rate_error_pitch=v[15],pid_output_roll=v[16],pid_output_pitch=v[17],received_monotonic=time.monotonic())
                with self._lock: self._diagnostics=item
                if self.on_diagnostics: self.on_diagnostics(item)
                return
            if packet_type == "DBG3" and len(parts) == 77:
                p=parts
                base=[float(x) for x in p[15:59]]
                item=ControlDiagnostics(
                    int(p[1]),int(p[2]),int(p[3]),int(p[4]),int(p[5]),int(p[6]),int(p[7]),int(p[8]),bool(int(p[9])),bool(int(p[10])),bool(int(p[11])),int(p[12]),int(p[13]),int(p[14]),
                    *base,float(p[59]),float(p[60]),float(p[61]),float(p[62]),bool(int(p[63])),bool(int(p[64])),bool(int(p[65])),bool(int(p[66])),bool(int(p[67])),bool(int(p[68])),
                    int(p[69]),int(p[70]),int(p[71]),int(p[72]),float(p[73]),float(p[74]),float(p[75]),int(p[76]),time.monotonic())
                with self._lock: self._diagnostics=item
                if self.on_diagnostics: self.on_diagnostics(item)
                return
            if packet_type == "DBG2" and len(parts) == 67:
                p=parts; base=[float(x) for x in p[15:59]]
                item=ControlDiagnostics(int(p[1]),int(p[2]),int(p[3]),int(p[4]),int(p[5]),int(p[6]),int(p[7]),int(p[8]),bool(int(p[9])),bool(int(p[10])),bool(int(p[11])),int(p[12]),int(p[13]),int(p[14]),*base,motor1=int(p[59]),motor2=int(p[60]),motor3=int(p[61]),motor4=int(p[62]),gyro_bias_roll=float(p[63]),gyro_bias_pitch=float(p[64]),gyro_bias_yaw=float(p[65]),imu_error_count=int(p[66]),received_monotonic=time.monotonic())
                with self._lock: self._diagnostics=item
                if self.on_diagnostics: self.on_diagnostics(item)
                return
            if packet_type == "DCFG2" and len(parts) == 44:
                p=parts
                item=DiagnosticConfig(firmware_major=int(p[1]),firmware_minor=int(p[2]),firmware_patch=int(p[3]),loop_period_us=int(p[4]),imu_i2c_speed=int(p[5]),telemetry_interval_ms=int(p[6]),status_interval_ms=int(p[7]),failsafe_timeout_ms=int(p[8]),imu_fail_limit=int(p[9]),angle_stick_scale=float(p[10]),rate_stick_scale=float(p[11]),max_angle_rate=float(p[12]),kalman_process_noise=float(p[13]),kalman_measurement_noise=float(p[14]),kalman_flight_measurement_noise=float(p[15]),kalman_initial_uncertainty=float(p[16]),acc_trust_full_mag_error=float(p[17]),acc_trust_reject_mag_error=float(p[18]),acc_trust_full_innovation=float(p[19]),acc_trust_reject_innovation=float(p[20]),pid_i_enable_throttle=float(p[21]),rate_i_limit=float(p[22]),angle_i_limit=float(p[23]),pid_output_limit=float(p[24]),throttle_max_us=float(p[25]),pwm_scale=float(p[26]),pwm_freq=int(p[27]),pwm_resolution=int(p[28]),motor_stop_duty=int(p[29]),motor_idle_duty=int(p[30]),motor_max_duty=int(p[31]),esc_min_duty=int(p[32]),esc_max_duty=int(p[33]),acc_cal_samples=int(p[34]),level_cal_samples=int(p[35]),cal_still_rate_limit=float(p[36]),imu_address=int(p[37]),imu_ctrl1_xl=int(p[38]),imu_ctrl2_g=int(p[39]),imu_ctrl6_c=int(p[40]),imu_ctrl8_xl=int(p[41]),imu_acc_sensitivity=float(p[42]),imu_gyro_sensitivity=float(p[43]),received_monotonic=time.monotonic())
                with self._lock: self._diagnostic_config=item
                if self.on_diagnostic_config: self.on_diagnostic_config(item)
                return
            if packet_type == "DCFG" and len(parts) == 36:
                p=parts
                item=DiagnosticConfig(firmware_major=int(p[1]),firmware_minor=int(p[2]),firmware_patch=int(p[3]),loop_period_us=int(p[4]),imu_i2c_speed=int(p[5]),telemetry_interval_ms=int(p[6]),status_interval_ms=int(p[7]),failsafe_timeout_ms=int(p[8]),imu_fail_limit=int(p[9]),angle_stick_scale=float(p[10]),rate_stick_scale=float(p[11]),max_angle_rate=float(p[12]),kalman_process_noise=float(p[13]),kalman_measurement_noise=float(p[14]),kalman_initial_uncertainty=float(p[15]),pid_i_enable_throttle=float(p[16]),throttle_max_us=float(p[17]),pwm_scale=float(p[18]),pwm_freq=int(p[19]),pwm_resolution=int(p[20]),motor_stop_duty=int(p[21]),motor_idle_duty=int(p[22]),motor_max_duty=int(p[23]),esc_min_duty=int(p[24]),esc_max_duty=int(p[25]),acc_cal_samples=int(p[26]),level_cal_samples=int(p[27]),cal_still_rate_limit=float(p[28]),imu_address=int(p[29]),imu_ctrl1_xl=int(p[30]),imu_ctrl2_g=int(p[31]),imu_ctrl6_c=int(p[32]),imu_ctrl8_xl=int(p[33]),imu_acc_sensitivity=float(p[34]),imu_gyro_sensitivity=float(p[35]),received_monotonic=time.monotonic())
                with self._lock: self._diagnostic_config=item
                if self.on_diagnostic_config: self.on_diagnostic_config(item)
                return
            if packet_type == "ALT" and len(parts) == 14:
                item=AltitudeData(int(parts[1]),int(parts[2]),float(parts[3]),float(parts[4]),float(parts[5]),float(parts[6]),float(parts[7]),float(parts[8]),float(parts[9]),float(parts[10]),float(parts[11]),bool(int(parts[12])),bool(int(parts[13])),time.monotonic())
                with self._lock: self._altitude=item
                if self.on_altitude: self.on_altitude(item)
                return
            if packet_type == "STAT" and len(parts) == 14:
                item=StatusData(int(parts[1]),bool(int(parts[2])),bool(int(parts[3])),bool(int(parts[4])),int(parts[5]),int(parts[6]),int(parts[7]),int(parts[8]),int(parts[9]),int(parts[10]),int(parts[11]),int(parts[12]),int(parts[13]),time.monotonic())
                with self._lock: self._status=item
                if self.on_status: self.on_status(item)
                return
            if packet_type == "EVT" and len(parts) == 5:
                item=EventData(int(parts[1]),parts[2].strip().upper(),parts[3].strip().upper(),int(parts[4]),time.monotonic())
                if self.on_event: self.on_event(item)
                return
            if packet_type == "PIDALLVAL" and len(parts) == 20:
                values=[float(v) for v in parts[1:]]
                pid=PIDValues.from_values(values[:PID_FIELD_COUNT]); altitude_pid=AltitudePIDValues.from_values(values[PID_FIELD_COUNT:]); pid.validate(); altitude_pid.validate()
                with self._lock: self._pid=pid; self._altitude_pid=altitude_pid; self._last_error=""
                if self.on_pid: self.on_pid(pid)
                if self.on_altitude_pid: self.on_altitude_pid(altitude_pid)
                return
            if packet_type == "PIDALLACK":
                with self._lock: self._last_ack="PIDALL:"+(parts[1] if len(parts)>1 else "ACK")
                return
            if packet_type == "MODEVAL" and len(parts) == 2:
                mode=int(parts[1])
                if mode not in {1000,1333,1667,2000}: raise ValueError("Invalid MODEVAL")
                with self._lock: self._saved_mode=mode; self._last_error=""
                if self.on_saved_mode: self.on_saved_mode(mode)
                return
            if packet_type == "MODEACK":
                with self._lock: self._last_ack="MODE:"+(parts[1] if len(parts)>1 else "ACK")
                return
            if packet_type == "MODEERR":
                reason=parts[1] if len(parts)>1 else "UNKNOWN_MODE_ERROR"
                with self._lock: self._last_error=reason
                return
            if packet_type == "PIDVAL" and len(parts) == 16:
                pid=PIDValues.from_values([float(v) for v in parts[1:]]); pid.validate()
                with self._lock: self._pid=pid; self._last_error=""
                if self.on_pid: self.on_pid(pid)
                return
            if packet_type == "ALTPIDVAL" and len(parts) == 5:
                pid=AltitudePIDValues.from_values([float(v) for v in parts[1:]]); pid.validate()
                with self._lock: self._altitude_pid=pid; self._last_error=""
                if self.on_altitude_pid: self.on_altitude_pid(pid)
                return
            if packet_type == "ALTPIDACK":
                with self._lock: self._last_ack="ALT:"+(parts[1] if len(parts)>1 else "ACK")
                return
            if packet_type == "ALTPIDERR":
                reason=parts[1] if len(parts)>1 else "UNKNOWN_ALT_PID_ERROR"
                with self._lock: self._last_error=reason
                return
            if packet_type == "PIDACK":
                with self._lock: self._last_ack=parts[1] if len(parts)>1 else "ACK"
                return
            if packet_type == "PIDERR":
                reason=parts[1] if len(parts)>1 else "UNKNOWN_PID_ERROR"
                with self._lock: self._last_error=reason
                return
            if packet_type == "CALVAL" and len(parts) == 9:
                values=CalibrationValues.from_values([float(v) for v in parts[1:]])
                with self._lock: self._calibration=values; self._last_error=""
                if self.on_calibration_values: self.on_calibration_values(values)
                return
            if packet_type == "CALSTAT" and len(parts) == 4:
                status=CalibrationStatus(bool(int(parts[1])),bool(int(parts[2])),bool(int(parts[3])),time.monotonic())
                with self._lock: self._calibration_status=status
                if self.on_calibration_status: self.on_calibration_status(status)
                return
            if packet_type == "CALACK":
                event=CalibrationEvent("ACK",parts[1].strip().upper() if len(parts)>1 else "CAL",parts[2].strip().upper() if len(parts)>2 else "",received_monotonic=time.monotonic())
                with self._lock: self._last_ack="CAL:"+event.action+(":"+event.detail if event.detail else ""); self._last_error=""
                if self.on_calibration_event: self.on_calibration_event(event)
                return
            if packet_type == "CALPROG" and len(parts) >= 6:
                event=CalibrationEvent("PROGRESS",parts[1].strip().upper(),position=parts[2].strip().upper(),completed=int(parts[3]),total=int(parts[4]),detail=parts[5].strip().upper(),received_monotonic=time.monotonic())
                if self.on_calibration_event: self.on_calibration_event(event)
                return
            if packet_type == "CALERR":
                action=parts[1].strip().upper() if len(parts)>1 else "CAL"; reason=parts[2].strip().upper() if len(parts)>2 else "UNKNOWN"
                event=CalibrationEvent("ERROR",action,reason,received_monotonic=time.monotonic())
                with self._lock: self._last_error=f"CAL {action}: {reason}"
                if self.on_calibration_event: self.on_calibration_event(event)
                return
            if packet_type == "ESCSTAT" and len(parts) == 3:
                status=ESCStatus(bool(int(parts[1])),int(parts[2]),time.monotonic())
                with self._lock: self._esc_status=status
                if self.on_esc_status: self.on_esc_status(status)
                return
            if packet_type == "ESCACK":
                event=ESCEvent("ACK",parts[1].strip().upper() if len(parts)>1 else "ESC",parts[2].strip().upper() if len(parts)>2 else "",received_monotonic=time.monotonic())
                with self._lock: self._last_ack="ESC:"+event.action+(":"+event.detail if event.detail else ""); self._last_error=""
                if self.on_esc_event: self.on_esc_event(event)
                return
            if packet_type == "ESCPROG" and len(parts) >= 3:
                event=ESCEvent("PROGRESS","ESC",phase=parts[1].strip().upper(),percent=int(parts[2]),received_monotonic=time.monotonic())
                if self.on_esc_event: self.on_esc_event(event)
                return
            if packet_type == "ESCERR":
                action=parts[1].strip().upper() if len(parts)>1 else "ESC"; reason=parts[2].strip().upper() if len(parts)>2 else "UNKNOWN"
                event=ESCEvent("ERROR",action,reason,received_monotonic=time.monotonic())
                with self._lock: self._last_error=f"ESC {action}: {reason}"
                if self.on_esc_event: self.on_esc_event(event)
                return
            if packet_type == "TRIMVAL" and len(parts) == 4:
                item=TrimValues(float(parts[1]),float(parts[2]),bool(int(parts[3])),time.monotonic())
                with self._lock: self._trim=item; self._last_error=""
                if self.on_trim_values: self.on_trim_values(item)
                return
            if packet_type == "TRIMACK":
                event=TrimEvent("ACK",parts[1].strip().upper() if len(parts)>1 else "TRIM",parts[2].strip().upper() if len(parts)>2 else "",time.monotonic())
                with self._lock: self._last_ack="TRIM:"+event.action+(":"+event.detail if event.detail else ""); self._last_error=""
                if self.on_trim_event: self.on_trim_event(event)
                return
            if packet_type == "TRIMERR":
                action=parts[1].strip().upper() if len(parts)>1 else "TRIM"; reason=parts[2].strip().upper() if len(parts)>2 else "UNKNOWN"
                event=TrimEvent("ERROR",action,reason,time.monotonic())
                with self._lock: self._last_error=f"TRIM {action}: {reason}"
                if self.on_trim_event: self.on_trim_event(event)
                return
            if packet_type == "PONG": return
        except ValueError:
            with self._lock: self._last_error=f"Invalid {packet_type or 'UDP'} packet"
            return
        if self.on_text: self.on_text(text)


__all__=["AltitudeData","AltitudePIDValues","CalibrationEvent","CalibrationStatus","CalibrationValues","ControlChannels","ControlDiagnostics","DiagnosticConfig","DroneWiFiClient","ESCEvent","ESCStatus","EventData","PIDValues","StatusData","TelemetryData","TrimEvent","TrimValues","TxDiagnostics"]
