'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _fulcrumSyncPlugin = require('fulcrum-sync-plugin');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

exports.default = class {
  constructor() {
    var _this = this;

    this.runCommand = _asyncToGenerator(function* () {
      yield _this.activate();

      const account = yield fulcrum.fetchAccount(fulcrum.args.org);

      if (account) {
        const form = yield account.findFirstForm({ name: fulcrum.args.form });

        const records = yield form.findRecordsBySQL(fulcrum.args.where);

        for (const record of records) {
          yield record.getForm();

          console.log('running', record.displayValue);

          yield _this.runReport({ record });
        }
      } else {
        console.error('Unable to find account', fulcrum.args.org);
      }
    });

    this.onRecordSave = (() => {
      var _ref2 = _asyncToGenerator(function* ({ record }) {
        _this.runReport({ record });
      });

      return function (_x) {
        return _ref2.apply(this, arguments);
      };
    })();

    this.runReport = (() => {
      var _ref3 = _asyncToGenerator(function* ({ record, template, header, footer, cover }) {
        const params = {
          reportName: record.displayValue || record.id,
          directory: fulcrum.dir('reports'),
          template: template || _this.template,
          header,
          footer,
          cover,
          data: {
            DateUtils: _fulcrumSyncPlugin.core.DateUtils,
            record: record,
            renderValues: _this.renderValues
          },
          ejsOptions: {}
        };

        yield _fulcrumSyncPlugin.ReportGenerator.generate(params);
      });

      return function (_x2) {
        return _ref3.apply(this, arguments);
      };
    })();

    this.renderValues = (feature, renderFunction) => {
      for (const element of feature.formValues.container.elements) {
        const formValue = feature.formValues.get(element.key);

        if (formValue) {
          renderFunction(element, formValue);
        }
      }
    };
  }

  task(cli) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      return cli.command({
        command: 'reports',
        desc: 'run the pdf reports sync for a specific organization',
        builder: {
          org: {
            desc: 'organization name',
            required: true,
            type: 'string'
          },
          form: {
            desc: 'form name',
            type: 'string'
          },
          where: {
            desc: 'sql where clause',
            type: 'string'
          },
          template: {
            desc: 'path to ejs template file',
            type: 'string'
          }
        },
        handler: _this2.runCommand
      });
    })();
  }

  activate() {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      const templateFile = fulcrum.args.template || 'template.ejs';

      _this3.template = _fs2.default.readFileSync(_path2.default.join(__dirname, templateFile)).toString();

      // fulcrum.on('record:save', this.onRecordSave);
    })();
  }

};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJydW5Db21tYW5kIiwiYWN0aXZhdGUiLCJhY2NvdW50IiwiZnVsY3J1bSIsImZldGNoQWNjb3VudCIsImFyZ3MiLCJvcmciLCJmb3JtIiwiZmluZEZpcnN0Rm9ybSIsIm5hbWUiLCJyZWNvcmRzIiwiZmluZFJlY29yZHNCeVNRTCIsIndoZXJlIiwicmVjb3JkIiwiZ2V0Rm9ybSIsImNvbnNvbGUiLCJsb2ciLCJkaXNwbGF5VmFsdWUiLCJydW5SZXBvcnQiLCJlcnJvciIsIm9uUmVjb3JkU2F2ZSIsInRlbXBsYXRlIiwiaGVhZGVyIiwiZm9vdGVyIiwiY292ZXIiLCJwYXJhbXMiLCJyZXBvcnROYW1lIiwiaWQiLCJkaXJlY3RvcnkiLCJkaXIiLCJkYXRhIiwiRGF0ZVV0aWxzIiwicmVuZGVyVmFsdWVzIiwiZWpzT3B0aW9ucyIsImdlbmVyYXRlIiwiZmVhdHVyZSIsInJlbmRlckZ1bmN0aW9uIiwiZWxlbWVudCIsImZvcm1WYWx1ZXMiLCJjb250YWluZXIiLCJlbGVtZW50cyIsImZvcm1WYWx1ZSIsImdldCIsImtleSIsInRhc2siLCJjbGkiLCJjb21tYW5kIiwiZGVzYyIsImJ1aWxkZXIiLCJyZXF1aXJlZCIsInR5cGUiLCJoYW5kbGVyIiwidGVtcGxhdGVGaWxlIiwicmVhZEZpbGVTeW5jIiwiam9pbiIsIl9fZGlybmFtZSIsInRvU3RyaW5nIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7OztBQUNBOzs7O0FBQ0E7Ozs7OztrQkFFZSxNQUFNO0FBQUE7QUFBQTs7QUFBQSxTQTRCbkJBLFVBNUJtQixxQkE0Qk4sYUFBWTtBQUN2QixZQUFNLE1BQUtDLFFBQUwsRUFBTjs7QUFFQSxZQUFNQyxVQUFVLE1BQU1DLFFBQVFDLFlBQVIsQ0FBcUJELFFBQVFFLElBQVIsQ0FBYUMsR0FBbEMsQ0FBdEI7O0FBRUEsVUFBSUosT0FBSixFQUFhO0FBQ1gsY0FBTUssT0FBTyxNQUFNTCxRQUFRTSxhQUFSLENBQXNCLEVBQUND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QUFoQixFQUFvREksUUFBcEQsRUFBaEI7O0FBRUE7QUFMZTtBQU1oQjs7QUF4RGtCLEMiLCJmaWxlIjoicGx1Z2luLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgUmVwb3J0R2VuZXJhdG9yLCBjb3JlIH0gZnJvbSAnZnVsY3J1bSc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIHtcbiAgYXN5bmMgdGFzayhjbGkpIHtcbiAgICByZXR1cm4gY2xpLmNvbW1hbmQoe1xuICAgICAgY29tbWFuZDogJ3JlcG9ydHMnLFxuICAgICAgZGVzYzogJ3J1biB0aGUgcGRmIHJlcG9ydHMgc3luYyBmb3IgYSBzcGVjaWZpYyBvcmdhbml6YXRpb24nLFxuICAgICAgYnVpbGRlcjoge1xuICAgICAgICBvcmc6IHtcbiAgICAgICAgICBkZXNjOiAnb3JnYW5pemF0aW9uIG5hbWUnLFxuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIGZvcm06IHtcbiAgICAgICAgICBkZXNjOiAnZm9ybSBuYW1lJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICB3aGVyZToge1xuICAgICAgICAgIGRlc2M6ICdzcWwgd2hlcmUgY2xhdXNlJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIGRlc2M6ICdwYXRoIHRvIGVqcyB0ZW1wbGF0ZSBmaWxlJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgaGFuZGxlcjogdGhpcy5ydW5Db21tYW5kXG4gICAgfSk7XG4gIH1cblxuICBydW5Db21tYW5kID0gYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IHRoaXMuYWN0aXZhdGUoKTtcblxuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcblxuICAgIGlmIChhY2NvdW50KSB7XG4gICAgICBjb25zdCBmb3JtID0gYXdhaXQgYWNjb3VudC5maW5kRmlyc3RGb3JtKHtuYW1lOiBmdWxjcnVtLmFyZ3MuZm9ybX0pO1xuXG4gICAgICBjb25zdCByZWNvcmRzID0gYXdhaXQgZm9ybS5maW5kUmVjb3Jkc0J5U1FMKGZ1bGNydW0uYXJncy53aGVyZSk7XG5cbiAgICAgIGZvciAoY29uc3QgcmVjb3JkIG9mIHJlY29yZHMpIHtcbiAgICAgICAgYXdhaXQgcmVjb3JkLmdldEZvcm0oKTtcblxuICAgICAgICBjb25zb2xlLmxvZygncnVubmluZycsIHJlY29yZC5kaXNwbGF5VmFsdWUpO1xuXG4gICAgICAgIGF3YWl0IHRoaXMucnVuUmVwb3J0KHtyZWNvcmR9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcignVW5hYmxlIHRvIGZpbmQgYWNjb3VudCcsIGZ1bGNydW0uYXJncy5vcmcpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGFjdGl2YXRlKCkge1xuICAgIGNvbnN0IHRlbXBsYXRlRmlsZSA9IGZ1bGNydW0uYXJncy50ZW1wbGF0ZSB8fCAndGVtcGxhdGUuZWpzJztcblxuICAgIHRoaXMudGVtcGxhdGUgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKF9fZGlybmFtZSwgdGVtcGxhdGVGaWxlKSkudG9TdHJpbmcoKTtcblxuICAgIC8vIGZ1bGNydW0ub24oJ3JlY29yZDpzYXZlJywgdGhpcy5vblJlY29yZFNhdmUpO1xuICB9XG5cbiAgb25SZWNvcmRTYXZlID0gYXN5bmMgKHtyZWNvcmR9KSA9PiB7XG4gICAgdGhpcy5ydW5SZXBvcnQoe3JlY29yZH0pO1xuICB9XG5cbiAgcnVuUmVwb3J0ID0gYXN5bmMgKHtyZWNvcmQsIHRlbXBsYXRlLCBoZWFkZXIsIGZvb3RlciwgY292ZXJ9KSA9PiB7XG4gICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgcmVwb3J0TmFtZTogcmVjb3JkLmRpc3BsYXlWYWx1ZSB8fCByZWNvcmQuaWQsXG4gICAgICBkaXJlY3Rvcnk6IGZ1bGNydW0uZGlyKCdyZXBvcnRzJyksXG4gICAgICB0ZW1wbGF0ZTogdGVtcGxhdGUgfHwgdGhpcy50ZW1wbGF0ZSxcbiAgICAgIGhlYWRlcixcbiAgICAgIGZvb3RlcixcbiAgICAgIGNvdmVyLFxuICAgICAgZGF0YToge1xuICAgICAgICBEYXRlVXRpbHM6IGNvcmUuRGF0ZVV0aWxzLFxuICAgICAgICByZWNvcmQ6IHJlY29yZCxcbiAgICAgICAgcmVuZGVyVmFsdWVzOiB0aGlzLnJlbmRlclZhbHVlc1xuICAgICAgfSxcbiAgICAgIGVqc09wdGlvbnM6IHt9XG4gICAgfTtcblxuICAgIGF3YWl0IFJlcG9ydEdlbmVyYXRvci5nZW5lcmF0ZShwYXJhbXMpO1xuICB9XG5cbiAgcmVuZGVyVmFsdWVzID0gKGZlYXR1cmUsIHJlbmRlckZ1bmN0aW9uKSA9PiB7XG4gICAgZm9yIChjb25zdCBlbGVtZW50IG9mIGZlYXR1cmUuZm9ybVZhbHVlcy5jb250YWluZXIuZWxlbWVudHMpIHtcbiAgICAgIGNvbnN0IGZvcm1WYWx1ZSA9IGZlYXR1cmUuZm9ybVZhbHVlcy5nZXQoZWxlbWVudC5rZXkpO1xuXG4gICAgICBpZiAoZm9ybVZhbHVlKSB7XG4gICAgICAgIHJlbmRlckZ1bmN0aW9uKGVsZW1lbnQsIGZvcm1WYWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=