'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

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
          directory: _this.reportPath,
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
          },
          reportPath: {
            desc: 'report storage directory',
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

      _this3.reportPath = fulcrum.args.reportPath || fulcrum.dir('reports');

      _mkdirp2.default.sync(_this3.reportPath);
      // fulcrum.on('record:save', this.onRecordSave);
    })();
  }

};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJydW5Db21tYW5kIiwiYWN0aXZhdGUiLCJhY2NvdW50IiwiZnVsY3J1bSIsImZldGNoQWNjb3VudCIsImFyZ3MiLCJvcmciLCJmb3JtIiwiZmluZEZpcnN0Rm9ybSIsIm5hbWUiLCJyZWNvcmRzIiwiZmluZFJlY29yZHNCeVNRTCIsIndoZXJlIiwicmVjb3JkIiwiZ2V0Rm9ybSIsImNvbnNvbGUiLCJsb2ciLCJkaXNwbGF5VmFsdWUiLCJydW5SZXBvcnQiLCJlcnJvciIsIm9uUmVjb3JkU2F2ZSIsInRlbXBsYXRlIiwiaGVhZGVyIiwiZm9vdGVyIiwiY292ZXIiLCJwYXJhbXMiLCJyZXBvcnROYW1lIiwiaWQiLCJkaXJlY3RvcnkiLCJyZXBvcnRQYXRoIiwiZGF0YSIsIkRhdGVVdGlscyIsInJlbmRlclZhbHVlcyIsImVqc09wdGlvbnMiLCJnZW5lcmF0ZSIsImZlYXR1cmUiLCJyZW5kZXJGdW5jdGlvbiIsImVsZW1lbnQiLCJmb3JtVmFsdWVzIiwiY29udGFpbmVyIiwiZWxlbWVudHMiLCJmb3JtVmFsdWUiLCJnZXQiLCJrZXkiLCJ0YXNrIiwiY2xpIiwiY29tbWFuZCIsImRlc2MiLCJidWlsZGVyIiwicmVxdWlyZWQiLCJ0eXBlIiwiaGFuZGxlciIsInRlbXBsYXRlRmlsZSIsImpvaW4iLCJfX2Rpcm5hbWUiLCJyZWFkRmlsZVN5bmMiLCJ0b1N0cmluZyIsImRpciIsInN5bmMiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7Ozs7a0JBRWUsTUFBTTtBQUFBO0FBQUE7O0FBQUEsU0FnQ25CQSxVQWhDbUIscUJBZ0NOLGFBQVk7QUFDdkIsWUFBTSxNQUFLQyxRQUFMLEVBQU47O0FBRUEsWUFBTUMsVUFBVSxNQUFNQyxRQUFRQyxZQUFSLENBQXFCRCxRQUFRRSxJQUFSLENBQWFDLEdBQWxDLENBQXRCOztBQUVBLFVBQUlKLE9BQUosRUFBYTtBQUNYLGNBQU1LLE9BQU8s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LFNBQVYsRUFBcUIsY0FBckIsQ0FBOUM7O0FBRUEsYUFBS2pDLFFBQUwsR0FBZ0IsYUFBR2tDLFlBQUgsQ0FBZ0JILFlBQWhCLEVBQThCSSxRQUE5QixFQUFoQjs7QUFFQSxhQUFLM0IsVUFBTCxHQUFrQjFCLFFBQVFFLElBQVIsQ0FBYXdCLFVBQWIsSUFBMkIxQixRQUFRc0QsR0FBUixDQUFZLFNBQVosQ0FBN0M7O0FBRUEsdUJBQU9DLElBQVAsQ0FBWSxPQUFLN0IsVUFBakI7QUFDQTtBQVJlO0FBU2hCOztBQS9Ea0IsQyIsImZpbGUiOiJwbHVnaW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgbWtkaXJwIGZyb20gJ21rZGlycCc7XG5pbXBvcnQgeyBSZXBvcnRHZW5lcmF0b3IsIGNvcmUgfSBmcm9tICdmdWxjcnVtJztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3Mge1xuICBhc3luYyB0YXNrKGNsaSkge1xuICAgIHJldHVybiBjbGkuY29tbWFuZCh7XG4gICAgICBjb21tYW5kOiAncmVwb3J0cycsXG4gICAgICBkZXNjOiAncnVuIHRoZSBwZGYgcmVwb3J0cyBzeW5jIGZvciBhIHNwZWNpZmljIG9yZ2FuaXphdGlvbicsXG4gICAgICBidWlsZGVyOiB7XG4gICAgICAgIG9yZzoge1xuICAgICAgICAgIGRlc2M6ICdvcmdhbml6YXRpb24gbmFtZScsXG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgZm9ybToge1xuICAgICAgICAgIGRlc2M6ICdmb3JtIG5hbWUnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgZGVzYzogJ3NxbCB3aGVyZSBjbGF1c2UnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgZGVzYzogJ3BhdGggdG8gZWpzIHRlbXBsYXRlIGZpbGUnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIHJlcG9ydFBhdGg6IHtcbiAgICAgICAgICBkZXNjOiAncmVwb3J0IHN0b3JhZ2UgZGlyZWN0b3J5JyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgaGFuZGxlcjogdGhpcy5ydW5Db21tYW5kXG4gICAgfSk7XG4gIH1cblxuICBydW5Db21tYW5kID0gYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IHRoaXMuYWN0aXZhdGUoKTtcblxuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcblxuICAgIGlmIChhY2NvdW50KSB7XG4gICAgICBjb25zdCBmb3JtID0gYXdhaXQgYWNjb3VudC5maW5kRmlyc3RGb3JtKHtuYW1lOiBmdWxjcnVtLmFyZ3MuZm9ybX0pO1xuXG4gICAgICBjb25zdCByZWNvcmRzID0gYXdhaXQgZm9ybS5maW5kUmVjb3Jkc0J5U1FMKGZ1bGNydW0uYXJncy53aGVyZSk7XG5cbiAgICAgIGZvciAoY29uc3QgcmVjb3JkIG9mIHJlY29yZHMpIHtcbiAgICAgICAgYXdhaXQgcmVjb3JkLmdldEZvcm0oKTtcblxuICAgICAgICBjb25zb2xlLmxvZygncnVubmluZycsIHJlY29yZC5kaXNwbGF5VmFsdWUpO1xuXG4gICAgICAgIGF3YWl0IHRoaXMucnVuUmVwb3J0KHtyZWNvcmR9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcignVW5hYmxlIHRvIGZpbmQgYWNjb3VudCcsIGZ1bGNydW0uYXJncy5vcmcpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGFjdGl2YXRlKCkge1xuICAgIGNvbnN0IHRlbXBsYXRlRmlsZSA9IGZ1bGNydW0uYXJncy50ZW1wbGF0ZSB8fCBwYXRoLmpvaW4oX19kaXJuYW1lLCAndGVtcGxhdGUuZWpzJyk7XG5cbiAgICB0aGlzLnRlbXBsYXRlID0gZnMucmVhZEZpbGVTeW5jKHRlbXBsYXRlRmlsZSkudG9TdHJpbmcoKTtcblxuICAgIHRoaXMucmVwb3J0UGF0aCA9IGZ1bGNydW0uYXJncy5yZXBvcnRQYXRoIHx8IGZ1bGNydW0uZGlyKCdyZXBvcnRzJyk7XG5cbiAgICBta2RpcnAuc3luYyh0aGlzLnJlcG9ydFBhdGgpO1xuICAgIC8vIGZ1bGNydW0ub24oJ3JlY29yZDpzYXZlJywgdGhpcy5vblJlY29yZFNhdmUpO1xuICB9XG5cbiAgb25SZWNvcmRTYXZlID0gYXN5bmMgKHtyZWNvcmR9KSA9PiB7XG4gICAgdGhpcy5ydW5SZXBvcnQoe3JlY29yZH0pO1xuICB9XG5cbiAgcnVuUmVwb3J0ID0gYXN5bmMgKHtyZWNvcmQsIHRlbXBsYXRlLCBoZWFkZXIsIGZvb3RlciwgY292ZXJ9KSA9PiB7XG4gICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgcmVwb3J0TmFtZTogcmVjb3JkLmRpc3BsYXlWYWx1ZSB8fCByZWNvcmQuaWQsXG4gICAgICBkaXJlY3Rvcnk6IHRoaXMucmVwb3J0UGF0aCxcbiAgICAgIHRlbXBsYXRlOiB0ZW1wbGF0ZSB8fCB0aGlzLnRlbXBsYXRlLFxuICAgICAgaGVhZGVyLFxuICAgICAgZm9vdGVyLFxuICAgICAgY292ZXIsXG4gICAgICBkYXRhOiB7XG4gICAgICAgIERhdGVVdGlsczogY29yZS5EYXRlVXRpbHMsXG4gICAgICAgIHJlY29yZDogcmVjb3JkLFxuICAgICAgICByZW5kZXJWYWx1ZXM6IHRoaXMucmVuZGVyVmFsdWVzXG4gICAgICB9LFxuICAgICAgZWpzT3B0aW9uczoge31cbiAgICB9O1xuXG4gICAgYXdhaXQgUmVwb3J0R2VuZXJhdG9yLmdlbmVyYXRlKHBhcmFtcyk7XG4gIH1cblxuICByZW5kZXJWYWx1ZXMgPSAoZmVhdHVyZSwgcmVuZGVyRnVuY3Rpb24pID0+IHtcbiAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZmVhdHVyZS5mb3JtVmFsdWVzLmNvbnRhaW5lci5lbGVtZW50cykge1xuICAgICAgY29uc3QgZm9ybVZhbHVlID0gZmVhdHVyZS5mb3JtVmFsdWVzLmdldChlbGVtZW50LmtleSk7XG5cbiAgICAgIGlmIChmb3JtVmFsdWUpIHtcbiAgICAgICAgcmVuZGVyRnVuY3Rpb24oZWxlbWVudCwgZm9ybVZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==