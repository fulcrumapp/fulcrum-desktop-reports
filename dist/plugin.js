'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _fulcrumDesktopPlugin = require('fulcrum-desktop-plugin');

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
            DateUtils: _fulcrumDesktopPlugin.core.DateUtils,
            record: record,
            renderValues: _this.renderValues
          },
          ejsOptions: {}
        };

        yield _fulcrumDesktopPlugin.ReportGenerator.generate(params);
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
      const templateFile = fulcrum.args.template || _path2.default.join(__dirname, 'template.ejs');

      _this3.template = _fs2.default.readFileSync(templateFile).toString();

      fulcrum.mkdirp('reports');
      // fulcrum.on('record:save', this.onRecordSave);
    })();
  }

};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJydW5Db21tYW5kIiwiYWN0aXZhdGUiLCJhY2NvdW50IiwiZnVsY3J1bSIsImZldGNoQWNjb3VudCIsImFyZ3MiLCJvcmciLCJmb3JtIiwiZmluZEZpcnN0Rm9ybSIsIm5hbWUiLCJyZWNvcmRzIiwiZmluZFJlY29yZHNCeVNRTCIsIndoZXJlIiwicmVjb3JkIiwiZ2V0Rm9ybSIsImNvbnNvbGUiLCJsb2ciLCJkaXNwbGF5VmFsdWUiLCJydW5SZXBvcnQiLCJlcnJvciIsIm9uUmVjb3JkU2F2ZSIsInRlbXBsYXRlIiwiaGVhZGVyIiwiZm9vdGVyIiwiY292ZXIiLCJwYXJhbXMiLCJyZXBvcnROYW1lIiwiaWQiLCJkaXJlY3RvcnkiLCJkaXIiLCJkYXRhIiwiRGF0ZVV0aWxzIiwicmVuZGVyVmFsdWVzIiwiZWpzT3B0aW9ucyIsImdlbmVyYXRlIiwiZmVhdHVyZSIsInJlbmRlckZ1bmN0aW9uIiwiZWxlbWVudCIsImZvcm1WYWx1ZXMiLCJjb250YWluZXIiLCJlbGVtZW50cyIsImZvcm1WYWx1ZSIsImdldCIsImtleSIsInRhc2siLCJjbGkiLCJjb21tYW5kIiwiZGVzYyIsImJ1aWxkZXIiLCJyZXF1aXJlZCIsInR5cGUiLCJoYW5kbGVyIiwidGVtcGxhdGVGaWxlIiwiam9pbiIsIl9fZGlybmFtZSIsInJlYWRGaWxlU3luYyIsInRvU3RyaW5nIiwibWtkaXJwIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7OztBQUNBOzs7O0FBQ0E7Ozs7OztrQkFFZSxNQUFNO0FBQUE7QUFBQTs7QUFBQSxTQTRCbkJBLFVBNUJtQixxQkE0Qk4sYUFBWTtBQUN2QixZQUFNLE1BQUtDLFFBQUwsRUFBTjs7QUFFQSxZQUFNQyxVQUFVLE1BQU1DLFFBQVFDLFlBQVIsQ0FBcUJELFFBQVFFLElBQVIsQ0FBYUMsR0FBbEMsQ0FBdEI7O0FBRUEsVUFBSUosT0FBSixFQUFhO0FBQ1gsY0FBTUssT0FBTyxNQUFNTCxRQUFRTSxhQUFSLENB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QUgsQ0FBZ0JILFlBQWhCLEVBQThCSSxRQUE5QixFQUFoQjs7QUFFQXJELGNBQVFzRCxNQUFSLENBQWUsU0FBZjtBQUNBO0FBTmU7QUFPaEI7O0FBekRrQixDIiwiZmlsZSI6InBsdWdpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IFJlcG9ydEdlbmVyYXRvciwgY29yZSB9IGZyb20gJ2Z1bGNydW0nO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyB7XG4gIGFzeW5jIHRhc2soY2xpKSB7XG4gICAgcmV0dXJuIGNsaS5jb21tYW5kKHtcbiAgICAgIGNvbW1hbmQ6ICdyZXBvcnRzJyxcbiAgICAgIGRlc2M6ICdydW4gdGhlIHBkZiByZXBvcnRzIHN5bmMgZm9yIGEgc3BlY2lmaWMgb3JnYW5pemF0aW9uJyxcbiAgICAgIGJ1aWxkZXI6IHtcbiAgICAgICAgb3JnOiB7XG4gICAgICAgICAgZGVzYzogJ29yZ2FuaXphdGlvbiBuYW1lJyxcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBmb3JtOiB7XG4gICAgICAgICAgZGVzYzogJ2Zvcm0gbmFtZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICBkZXNjOiAnc3FsIHdoZXJlIGNsYXVzZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBkZXNjOiAncGF0aCB0byBlanMgdGVtcGxhdGUgZmlsZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGhhbmRsZXI6IHRoaXMucnVuQ29tbWFuZFxuICAgIH0pO1xuICB9XG5cbiAgcnVuQ29tbWFuZCA9IGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCB0aGlzLmFjdGl2YXRlKCk7XG5cbiAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZnVsY3J1bS5mZXRjaEFjY291bnQoZnVsY3J1bS5hcmdzLm9yZyk7XG5cbiAgICBpZiAoYWNjb3VudCkge1xuICAgICAgY29uc3QgZm9ybSA9IGF3YWl0IGFjY291bnQuZmluZEZpcnN0Rm9ybSh7bmFtZTogZnVsY3J1bS5hcmdzLmZvcm19KTtcblxuICAgICAgY29uc3QgcmVjb3JkcyA9IGF3YWl0IGZvcm0uZmluZFJlY29yZHNCeVNRTChmdWxjcnVtLmFyZ3Mud2hlcmUpO1xuXG4gICAgICBmb3IgKGNvbnN0IHJlY29yZCBvZiByZWNvcmRzKSB7XG4gICAgICAgIGF3YWl0IHJlY29yZC5nZXRGb3JtKCk7XG5cbiAgICAgICAgY29uc29sZS5sb2coJ3J1bm5pbmcnLCByZWNvcmQuZGlzcGxheVZhbHVlKTtcblxuICAgICAgICBhd2FpdCB0aGlzLnJ1blJlcG9ydCh7cmVjb3JkfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuYWJsZSB0byBmaW5kIGFjY291bnQnLCBmdWxjcnVtLmFyZ3Mub3JnKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBhY3RpdmF0ZSgpIHtcbiAgICBjb25zdCB0ZW1wbGF0ZUZpbGUgPSBmdWxjcnVtLmFyZ3MudGVtcGxhdGUgfHwgcGF0aC5qb2luKF9fZGlybmFtZSwgJ3RlbXBsYXRlLmVqcycpO1xuXG4gICAgdGhpcy50ZW1wbGF0ZSA9IGZzLnJlYWRGaWxlU3luYyh0ZW1wbGF0ZUZpbGUpLnRvU3RyaW5nKCk7XG5cbiAgICBmdWxjcnVtLm1rZGlycCgncmVwb3J0cycpXG4gICAgLy8gZnVsY3J1bS5vbigncmVjb3JkOnNhdmUnLCB0aGlzLm9uUmVjb3JkU2F2ZSk7XG4gIH1cblxuICBvblJlY29yZFNhdmUgPSBhc3luYyAoe3JlY29yZH0pID0+IHtcbiAgICB0aGlzLnJ1blJlcG9ydCh7cmVjb3JkfSk7XG4gIH1cblxuICBydW5SZXBvcnQgPSBhc3luYyAoe3JlY29yZCwgdGVtcGxhdGUsIGhlYWRlciwgZm9vdGVyLCBjb3Zlcn0pID0+IHtcbiAgICBjb25zdCBwYXJhbXMgPSB7XG4gICAgICByZXBvcnROYW1lOiByZWNvcmQuZGlzcGxheVZhbHVlIHx8IHJlY29yZC5pZCxcbiAgICAgIGRpcmVjdG9yeTogZnVsY3J1bS5kaXIoJ3JlcG9ydHMnKSxcbiAgICAgIHRlbXBsYXRlOiB0ZW1wbGF0ZSB8fCB0aGlzLnRlbXBsYXRlLFxuICAgICAgaGVhZGVyLFxuICAgICAgZm9vdGVyLFxuICAgICAgY292ZXIsXG4gICAgICBkYXRhOiB7XG4gICAgICAgIERhdGVVdGlsczogY29yZS5EYXRlVXRpbHMsXG4gICAgICAgIHJlY29yZDogcmVjb3JkLFxuICAgICAgICByZW5kZXJWYWx1ZXM6IHRoaXMucmVuZGVyVmFsdWVzXG4gICAgICB9LFxuICAgICAgZWpzT3B0aW9uczoge31cbiAgICB9O1xuXG4gICAgYXdhaXQgUmVwb3J0R2VuZXJhdG9yLmdlbmVyYXRlKHBhcmFtcyk7XG4gIH1cblxuICByZW5kZXJWYWx1ZXMgPSAoZmVhdHVyZSwgcmVuZGVyRnVuY3Rpb24pID0+IHtcbiAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZmVhdHVyZS5mb3JtVmFsdWVzLmNvbnRhaW5lci5lbGVtZW50cykge1xuICAgICAgY29uc3QgZm9ybVZhbHVlID0gZmVhdHVyZS5mb3JtVmFsdWVzLmdldChlbGVtZW50LmtleSk7XG5cbiAgICAgIGlmIChmb3JtVmFsdWUpIHtcbiAgICAgICAgcmVuZGVyRnVuY3Rpb24oZWxlbWVudCwgZm9ybVZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==