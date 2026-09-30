"""Classroom source adapter: regular Python syntax around async browser I/O.

Opt in with ``from zebjus_simple import Drone``. The runtime substitutes that
import with the browser Drone and adds awaits only to known I/O calls.
"""
import ast

IO_METHODS = frozenset({
    'status', 'i2c_scan', 'imu', 'gyro', 'accel', 'attitude', 'receiver',
    'ppm', 'pid_get', 'restore_pid_defaults', 'set_rate_pid', 'set_angle_pid',
    'rc', 'keys', 'camera_frame', 'hands', 'wait_key', 'motor_test',
    'motor_stop', 'motor_order_test', 'esc_calibrate', 'bench_status',
    'get_calibration', 'set_accel_offsets', 'level_calibrate',
    'restore_calibration_defaults', 'calibrate_gyro', 'pinmap_get',
    'motor_map_get', 'motor_map_set', 'ppm_config', 'i2c_read', 'i2c_write',
    'servo_config', 'servo_write', 'gps_config', 'gps_read', 'matrix_config',
    'matrix_write', 'matrix_read', 'gpio_read', 'gpio_write', 'gpio_release',
    'led_set', 'led_read', 'led',
})


def transform(source):
    tree = ast.parse(source)
    helpers = {node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)}

    class Adapter(ast.NodeTransformer):
        def visit_ImportFrom(self, node):
            if node.module == 'zebjus_simple':
                if any(item.name != 'Drone' or item.asname for item in node.names):
                    raise SyntaxError('Use: from zebjus_simple import Drone')
                node.module = 'zebjus'
            return node

        def visit_While(self, node):
            self.generic_visit(node)
            if isinstance(node.test, ast.Constant) and node.test.value is True:
                # Every unconditional classroom loop yields to the browser/RC bridge.
                delay = ast.parse('await asyncio.sleep(0.02)').body[0]
                node.body.insert(0, ast.copy_location(delay, node.body[0]))
            return node

        def visit_FunctionDef(self, node):
            self.generic_visit(node)
            return ast.copy_location(ast.AsyncFunctionDef(
                name=node.name, args=node.args, body=node.body,
                decorator_list=node.decorator_list, returns=node.returns,
                type_comment=node.type_comment), node)

        def visit_Call(self, node):
            self.generic_visit(node)
            fn = node.func
            if isinstance(fn, ast.Attribute) and isinstance(fn.value, ast.Name) and fn.value.id == 'cv2' and fn.attr in ('waitkey', 'waitKey'):
                if len(node.args) != 1 or node.keywords:
                    raise SyntaxError('cv2.waitkey needs one delay in milliseconds')
                seconds = ast.BinOp(left=node.args[0], op=ast.Div(), right=ast.Constant(1000))
                delay = ast.Call(func=ast.Attribute(value=ast.Name(id='asyncio', ctx=ast.Load()), attr='sleep', ctx=ast.Load()), args=[seconds], keywords=[])
                return ast.copy_location(ast.Await(value=delay), node)
            needed = (isinstance(fn, ast.Attribute) and
                      isinstance(fn.value, ast.Name) and fn.value.id == 'drone' and
                      fn.attr in IO_METHODS)
            needed |= isinstance(fn, ast.Name) and fn.id in helpers
            if isinstance(fn, ast.Attribute) and isinstance(fn.value, ast.Name):
                needed |= fn.value.id in ('time', 'asyncio') and fn.attr == 'sleep'
                if needed and fn.value.id == 'time':
                    fn.value.id = 'asyncio'
            if isinstance(fn, ast.Name) and fn.id == 'sleep':
                fn.id = '_zebjus_sleep'
                needed = True
            return ast.copy_location(ast.Await(value=node), node) if needed else node

    tree = Adapter().visit(tree)
    ast.fix_missing_locations(tree)
    return 'import asyncio\n_zebjus_sleep = asyncio.sleep\n' + ast.unparse(tree)
