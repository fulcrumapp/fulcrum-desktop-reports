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

var _concurrentQueue = require('./concurrent-queue');

var _concurrentQueue2 = _interopRequireDefault(_concurrentQueue);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

exports.default = class {
  constructor() {
    var _this = this;

    this.runCommand = _asyncToGenerator(function* () {
      yield _this.activate();

      const account = yield fulcrum.fetchAccount(fulcrum.args.org);

      const skipForms = fulcrum.args.reportsSkip || [];
      const includeForms = fulcrum.args.form != null ? fulcrum.args.form : null;

      if (account) {
        _this.account = account;

        const forms = yield account.findForms({});

        const concurrency = Math.min(Math.max(1, fulcrum.args.reportsConcurrency || 5), 50);

        _this.queue = new _concurrentQueue2.default(_this.workerFunction, concurrency);

        for (const form of forms) {
          if (skipForms.indexOf(form.name) > -1) {
            continue;
          }

          if (includeForms && includeForms.indexOf(form.name) === -1) {
            continue;
          }

          yield form.findEachRecord({}, (() => {
            var _ref2 = _asyncToGenerator(function* (record) {
              _this.queue.push({ id: record.rowID });
            });

            return function (_x) {
              return _ref2.apply(this, arguments);
            };
          })());
        }

        yield _this.queue.drain();
      } else {
        console.error('Unable to find account', fulcrum.args.org);
      }
    });

    this.workerFunction = (() => {
      var _ref3 = _asyncToGenerator(function* (task) {
        try {
          const record = yield _this.account.findFirstRecord({ id: task.id });

          yield record.getForm();

          yield _this.runReport({ record });
        } catch (err) {
          console.error('Error', err);
        }
      });

      return function (_x2) {
        return _ref3.apply(this, arguments);
      };
    })();

    this.onRecordSave = (() => {
      var _ref4 = _asyncToGenerator(function* ({ record }) {
        _this.runReport({ record });
      });

      return function (_x3) {
        return _ref4.apply(this, arguments);
      };
    })();

    this.runReport = (() => {
      var _ref5 = _asyncToGenerator(function* ({ record, template, header, footer, cover }) {
        const fileName = _this.reportsFileName === 'title' ? record.displayValue || record.id : record.id;

        const outputFileName = _path2.default.join(_this.reportPath, fileName + '.pdf');

        if (_fs2.default.existsSync(outputFileName) && _fs2.default.statSync(outputFileName).size > 0) {
          return;
        }

        const params = {
          reportName: fileName,
          directory: _this.reportPath,
          template: template || _this.template,
          header: header || _this.header,
          footer: footer || _this.footer,
          cover,
          data: {
            DateUtils: _fulcrumDesktopPlugin.core.DateUtils,
            record: record,
            renderValues: _this.renderValues,
            getPhotoURL: _this.getPhotoURL
          },
          ejsOptions: {},
          reportOptions: {
            wkhtmltopdf: fulcrum.args.reportsWkhtmltopdf
          }
        };

        yield _this.generatePDF(params);

        if (fulcrum.args.reportsRepeatables) {
          for (const item of record.formValues.repeatableItems) {
            const repeatableFileName = _this.reportsFileName === 'title' ? `${fileName} - ${item.displayValue}` : item.id;

            params.reportName = repeatableFileName;
            params.data.record = item;

            yield _this.generatePDF(params);
          }
        }
      });

      return function (_x4) {
        return _ref5.apply(this, arguments);
      };
    })();

    this.getPhotoURL = item => {
      if (fulcrum.args.reportsMediaPath) {
        return _path2.default.join(fulcrum.args.reportsMediaPath, 'photos', item.mediaID + '.jpg');
      }

      const url = _fulcrumDesktopPlugin.APIClient.getPhotoURL(this.account, { id: item.mediaID }).replace('?', '/large?');

      if (url.indexOf('.jpg') === -1) {
        return url.replace('?', '.jpg?');
      }

      return url;
    };

    this.renderValues = (feature, renderFunction) => {
      return this.renderValuesRecursive(feature, feature.formValues.container.elements, renderFunction);
    };

    this.renderValuesRecursive = (feature, elements, renderFunction) => {
      for (const element of elements) {
        const formValue = feature.formValues.get(element.key);

        renderFunction(element, formValue);

        if (element.isSectionElement) {
          this.renderValuesRecursive(feature, element.elements, renderFunction);
        } else if (element.isRepeatableElement) {
          let shouldRecurse = true;

          if (element.isRepeatableElement && fulcrum.args.reportsRecurse === false) {
            shouldRecurse = false;
          }

          if (formValue && shouldRecurse) {
            for (const item of formValue.items) {
              this.renderValuesRecursive(item, element.elements, renderFunction);
            }
          }
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
            type: 'array'
          },
          reportsSkip: {
            desc: 'skip form name',
            type: 'array'
          },
          reportsTemplate: {
            desc: 'path to ejs template file',
            type: 'string'
          },
          reportsHeader: {
            desc: 'path to header ejs template file',
            type: 'string'
          },
          reportsFooter: {
            desc: 'path to footer ejs template file',
            type: 'string'
          },
          reportsPath: {
            desc: 'report storage directory',
            type: 'string'
          },
          reportsMediaPath: {
            desc: 'media storage directory',
            type: 'string'
          },
          reportsFileName: {
            desc: 'file name',
            type: 'string'
          },
          reportsConcurrency: {
            desc: 'concurrent reports (between 1 and 10)',
            type: 'number',
            default: 5
          },
          reportsRepeatables: {
            desc: 'generate a PDF for each repeatable child record',
            type: 'boolean',
            default: false
          },
          reportsRecurse: {
            desc: 'recursively print all child items in each PDF',
            type: 'boolean',
            default: true
          },
          reportsWkhtmltopdf: {
            desc: 'path to wkhtmltopdf binary',
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
      const templateFile = fulcrum.args.reportsTemplate || _path2.default.join(__dirname, 'template.ejs');

      _this3.template = _fs2.default.readFileSync(templateFile).toString();

      if (fulcrum.args.reportsHeader) {
        _this3.header = _fs2.default.readFileSync(fulcrum.args.reportsHeader).toString();
      }

      if (fulcrum.args.reportsFooter) {
        _this3.footer = _fs2.default.readFileSync(fulcrum.args.reportsFooter).toString();
      }

      _this3.reportsPath = fulcrum.args.reportsPath || fulcrum.dir('reports');
      _this3.reportsFileName = fulcrum.args.reportsFileName === 'title' ? 'title' : 'id';

      _mkdirp2.default.sync(_this3.reportPath);
      // fulcrum.on('record:save', this.onRecordSave);
    })();
  }

  generatePDF(params) {
    return _asyncToGenerator(function* () {
      console.log('Generating', params.data.record.isRecord ? 'record'.green : 'child record'.green, params.reportName);
      return yield _fulcrumDesktopPlugin.ReportGenerator.generate(params);
    })();
  }

};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJydW5Db21tYW5kIiwiYWN0aXZhdGUiLCJhY2NvdW50IiwiZnVsY3J1bSIsImZldGNoQWNjb3VudCIsImFyZ3MiLCJvcmciLCJza2lwRm9ybXMiLCJyZXBvcnRzU2tpcCIsImluY2x1ZGVGb3JtcyIsImZvcm0iLCJmb3JtcyIsImZpbmRGb3JtcyIsImNvbmN1cnJlbmN5IiwiTWF0aCIsIm1pbiIsIm1heCIsInJlcG9ydHNDb25jdXJyZW5jeSIsInF1ZXVlIiwid29ya2VyRnVuY3Rpb24iLCJpbmRleE9mIiwibmFtZSIsImZpbmRFYWNoUmVjb3JkIiwicmVjb3JkIiwicHVzaCIsImlkIiwicm93SUQiLCJkcmFpbiIsImNvbnNvbGUiLCJlcnJvciIsInRhc2siLCJmaW5kRmlyc3RSZWNvcmQiLCJnZXRGb3JtIiwicnVuUmVwb3J0IiwiZXJyIiwib25SZWNvcmRTYXZlIiwidGVtcGxhdGUiLCJoZWFkZXIiLCJmb290ZXIiLCJjb3ZlciIsImZpbGVOYW1lIiwicmVwb3J0c0ZpbGVOYW1lIiwiZGlzcGxheVZhbHVlIiwib3V0cHV0RmlsZU5hbWUiLCJqb2luIiwicmVwb3J0UGF0aCIsImV4aXN0c1N5bmMiLCJzdGF0U3luYyIsInNpemUiLCJwYXJhbXMiLCJyZXBvcnROYW1lIiwiZGlyZWN0b3J5IiwiZGF0YSIsIkRhdGVVdGlscyIsInJlbmRlclZhbHVlcyIsImdldFBob3RvVVJMIiwiZWpzT3B0aW9ucyIsInJlcG9ydE9wdGlvbnMiLCJ3a2h0bWx0b3BkZiIsInJlcG9ydHNXa2h0bWx0b3BkZiIsImdlbmVyYXRlUERGIiwicmVwb3J0c1JlcGVhdGFibGVzIiwiaXRlbSIsImZvcm1WYWx1ZXMiLCJyZXBlYXRhYmxlSXRlbXMiLCJyZXBlYXRhYmxlRmlsZU5hbWUiLCJyZXBvcnRzTWVkaWFQYXRoIiwibWVkaWFJRCIsInVybCIsInJlcGxhY2UiLCJmZWF0dXJlIiwicmVuZGVyRnVuY3Rpb24iLCJyZW5kZXJWYWx1ZXNSZWN1cnNpdmUiLCJjb250YWluZXIiLCJlbGVtZW50cyIsImVsZW1lbnQiLCJmb3JtVmFsdWUiLCJnZXQiLCJrZXkiLCJpc1NlY3Rpb25FbGVtZW50IiwiaXNSZXBlYXRhYmxlRWxlbWVudCIsInNob3VsZFJlY3Vyc2UiLCJyZXBvcnRzUmVjdXJzZSIsIml0ZW1zIiwiY2xpIiwiY29tbWFuZCIsImRlc2MiLCJidWlsZGVyIiwicmVxdWlyZWQiLCJ0eXBlIiwicmVwb3J0c1RlbXBsYXRlIiwicmVwb3J0c0hlYWRlciIsInJlcG9ydHNGb290ZXIiLCJyZXBvcnRzUGF0aCIsImRlZmF1bHQiLCJoYW5kbGVyIiwidGVtcGxhdGVGaWxlIiwiX19kaXJuYW1lIiwicmVhZEZpbGVTeW5jIiwidG9TdHJpbmciLCJkaXIiLCJzeW5jIiwibG9nIiwiaXNSZWNvcmQiLCJncmVlbiIsImdlbmVyYXRlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7QUFDQTs7Ozs7Ozs7a0JBRWUsTUFBTTtBQUFBO0FBQUE7O0FBQUEsU0FtRW5CQSxVQW5FbUIscUJBbUVOLGFBQVk7QUFDdkIsWUFBTSxNQUFLQyxRQUFMLEVBQU47O0FBRUEsWUFBTUMsVUFBVSxNQUFNQyxRQUFRQyxZQUFSLENBQXFCRCxRQUFRRSxJQUFSLENBQWFDLEdBQWxDLENBQXRCOztBQUVBLFlBQU1DLFlBQVlKLFFBQVFFLElBQVIsQ0FBYUcsV0FBYixJQUE0QixFQUE5QztBQUNBLFlBQU1DLGVBQWVOLFFBQVFFLElBQVIsQ0FBYUssSUFBYixJQUFxQixJQUFyQixHQUE0QlAsUUFBUUUsSUFBUixDQUFhSyxJQUF6QyxHQUFnRCxJQUFyRTs7QUFFQSxVQUFJUixPQUFKLEVBQWE7QUFDWCxjQUFLQSxPQUFMLEdBQWVBLE9BQWY7O0FBRUEsY0FBTVMsUUFBUSxNQUFNVCxRQUFRVSxTQUFSLENBQWtCLEVBQWxCLENBQXBCOztBQUVBLGNBQU1DLGNBQWNDLEtBQUtDLEdBQUwsQ0FBU0QsS0FBS0UsR0FBTCxDQUFTLENBQVQs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dXJjZXNDb250ZW50IjpbImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBta2RpcnAgZnJvbSAnbWtkaXJwJztcbmltcG9ydCB7IFJlcG9ydEdlbmVyYXRvciwgQVBJQ2xpZW50LCBjb3JlIH0gZnJvbSAnZnVsY3J1bSc7XG5pbXBvcnQgQ29uY3VycmVudFF1ZXVlIGZyb20gJy4vY29uY3VycmVudC1xdWV1ZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIHtcbiAgYXN5bmMgdGFzayhjbGkpIHtcbiAgICByZXR1cm4gY2xpLmNvbW1hbmQoe1xuICAgICAgY29tbWFuZDogJ3JlcG9ydHMnLFxuICAgICAgZGVzYzogJ3J1biB0aGUgcGRmIHJlcG9ydHMgc3luYyBmb3IgYSBzcGVjaWZpYyBvcmdhbml6YXRpb24nLFxuICAgICAgYnVpbGRlcjoge1xuICAgICAgICBvcmc6IHtcbiAgICAgICAgICBkZXNjOiAnb3JnYW5pemF0aW9uIG5hbWUnLFxuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIGZvcm06IHtcbiAgICAgICAgICBkZXNjOiAnZm9ybSBuYW1lJyxcbiAgICAgICAgICB0eXBlOiAnYXJyYXknXG4gICAgICAgIH0sXG4gICAgICAgIHJlcG9ydHNTa2lwOiB7XG4gICAgICAgICAgZGVzYzogJ3NraXAgZm9ybSBuYW1lJyxcbiAgICAgICAgICB0eXBlOiAnYXJyYXknXG4gICAgICAgIH0sXG4gICAgICAgIHJlcG9ydHNUZW1wbGF0ZToge1xuICAgICAgICAgIGRlc2M6ICdwYXRoIHRvIGVqcyB0ZW1wbGF0ZSBmaWxlJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICByZXBvcnRzSGVhZGVyOiB7XG4gICAgICAgICAgZGVzYzogJ3BhdGggdG8gaGVhZGVyIGVqcyB0ZW1wbGF0ZSBmaWxlJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICByZXBvcnRzRm9vdGVyOiB7XG4gICAgICAgICAgZGVzYzogJ3BhdGggdG8gZm9vdGVyIGVqcyB0ZW1wbGF0ZSBmaWxlJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICByZXBvcnRzUGF0aDoge1xuICAgICAgICAgIGRlc2M6ICdyZXBvcnQgc3RvcmFnZSBkaXJlY3RvcnknLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIHJlcG9ydHNNZWRpYVBhdGg6IHtcbiAgICAgICAgICBkZXNjOiAnbWVkaWEgc3RvcmFnZSBkaXJlY3RvcnknLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIHJlcG9ydHNGaWxlTmFtZToge1xuICAgICAgICAgIGRlc2M6ICdmaWxlIG5hbWUnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIHJlcG9ydHNDb25jdXJyZW5jeToge1xuICAgICAgICAgIGRlc2M6ICdjb25jdXJyZW50IHJlcG9ydHMgKGJldHdlZW4gMSBhbmQgMTApJyxcbiAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICBkZWZhdWx0OiA1XG4gICAgICAgIH0sXG4gICAgICAgIHJlcG9ydHNSZXBlYXRhYmxlczoge1xuICAgICAgICAgIGRlc2M6ICdnZW5lcmF0ZSBhIFBERiBmb3IgZWFjaCByZXBlYXRhYmxlIGNoaWxkIHJlY29yZCcsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgIH0sXG4gICAgICAgIHJlcG9ydHNSZWN1cnNlOiB7XG4gICAgICAgICAgZGVzYzogJ3JlY3Vyc2l2ZWx5IHByaW50IGFsbCBjaGlsZCBpdGVtcyBpbiBlYWNoIFBERicsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgcmVwb3J0c1draHRtbHRvcGRmOiB7XG4gICAgICAgICAgZGVzYzogJ3BhdGggdG8gd2todG1sdG9wZGYgYmluYXJ5JyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgaGFuZGxlcjogdGhpcy5ydW5Db21tYW5kXG4gICAgfSk7XG4gIH1cblxuICBydW5Db21tYW5kID0gYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IHRoaXMuYWN0aXZhdGUoKTtcblxuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcblxuICAgIGNvbnN0IHNraXBGb3JtcyA9IGZ1bGNydW0uYXJncy5yZXBvcnRzU2tpcCB8fCBbXTtcbiAgICBjb25zdCBpbmNsdWRlRm9ybXMgPSBmdWxjcnVtLmFyZ3MuZm9ybSAhPSBudWxsID8gZnVsY3J1bS5hcmdzLmZvcm0gOiBudWxsO1xuXG4gICAgaWYgKGFjY291bnQpIHtcbiAgICAgIHRoaXMuYWNjb3VudCA9IGFjY291bnQ7XG5cbiAgICAgIGNvbnN0IGZvcm1zID0gYXdhaXQgYWNjb3VudC5maW5kRm9ybXMoe30pO1xuXG4gICAgICBjb25zdCBjb25jdXJyZW5jeSA9IE1hdGgubWluKE1hdGgubWF4KDEsIGZ1bGNydW0uYXJncy5yZXBvcnRzQ29uY3VycmVuY3kgfHwgNSksIDUwKTtcblxuICAgICAgdGhpcy5xdWV1ZSA9IG5ldyBDb25jdXJyZW50UXVldWUodGhpcy53b3JrZXJGdW5jdGlvbiwgY29uY3VycmVuY3kpO1xuXG4gICAgICBmb3IgKGNvbnN0IGZvcm0gb2YgZm9ybXMpIHtcbiAgICAgICAgaWYgKHNraXBGb3Jtcy5pbmRleE9mKGZvcm0ubmFtZSkgPiAtMSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluY2x1ZGVGb3JtcyAmJiBpbmNsdWRlRm9ybXMuaW5kZXhPZihmb3JtLm5hbWUpID09PSAtMSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgZm9ybS5maW5kRWFjaFJlY29yZCh7fSwgYXN5bmMgKHJlY29yZCkgPT4ge1xuICAgICAgICAgIHRoaXMucXVldWUucHVzaCh7aWQ6IHJlY29yZC5yb3dJRH0pO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy5xdWV1ZS5kcmFpbigpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuYWJsZSB0byBmaW5kIGFjY291bnQnLCBmdWxjcnVtLmFyZ3Mub3JnKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBhY3RpdmF0ZSgpIHtcbiAgICBjb25zdCB0ZW1wbGF0ZUZpbGUgPSBmdWxjcnVtLmFyZ3MucmVwb3J0c1RlbXBsYXRlIHx8IHBhdGguam9pbihfX2Rpcm5hbWUsICd0ZW1wbGF0ZS5lanMnKTtcblxuICAgIHRoaXMudGVtcGxhdGUgPSBmcy5yZWFkRmlsZVN5bmModGVtcGxhdGVGaWxlKS50b1N0cmluZygpO1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5yZXBvcnRzSGVhZGVyKSB7XG4gICAgICB0aGlzLmhlYWRlciA9IGZzLnJlYWRGaWxlU3luYyhmdWxjcnVtLmFyZ3MucmVwb3J0c0hlYWRlcikudG9TdHJpbmcoKTtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLnJlcG9ydHNGb290ZXIpIHtcbiAgICAgIHRoaXMuZm9vdGVyID0gZnMucmVhZEZpbGVTeW5jKGZ1bGNydW0uYXJncy5yZXBvcnRzRm9vdGVyKS50b1N0cmluZygpO1xuICAgIH1cblxuICAgIHRoaXMucmVwb3J0c1BhdGggPSBmdWxjcnVtLmFyZ3MucmVwb3J0c1BhdGggfHwgZnVsY3J1bS5kaXIoJ3JlcG9ydHMnKTtcbiAgICB0aGlzLnJlcG9ydHNGaWxlTmFtZSA9IGZ1bGNydW0uYXJncy5yZXBvcnRzRmlsZU5hbWUgPT09ICd0aXRsZScgPyAndGl0bGUnIDogJ2lkJztcblxuICAgIG1rZGlycC5zeW5jKHRoaXMucmVwb3J0UGF0aCk7XG4gICAgLy8gZnVsY3J1bS5vbigncmVjb3JkOnNhdmUnLCB0aGlzLm9uUmVjb3JkU2F2ZSk7XG4gIH1cblxuICB3b3JrZXJGdW5jdGlvbiA9IGFzeW5jICh0YXNrKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlY29yZCA9IGF3YWl0IHRoaXMuYWNjb3VudC5maW5kRmlyc3RSZWNvcmQoe2lkOiB0YXNrLmlkfSk7XG5cbiAgICAgIGF3YWl0IHJlY29yZC5nZXRGb3JtKCk7XG5cbiAgICAgIGF3YWl0IHRoaXMucnVuUmVwb3J0KHtyZWNvcmR9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yJywgZXJyKTtcbiAgICB9XG4gIH1cblxuICBvblJlY29yZFNhdmUgPSBhc3luYyAoe3JlY29yZH0pID0+IHtcbiAgICB0aGlzLnJ1blJlcG9ydCh7cmVjb3JkfSk7XG4gIH1cblxuICBydW5SZXBvcnQgPSBhc3luYyAoe3JlY29yZCwgdGVtcGxhdGUsIGhlYWRlciwgZm9vdGVyLCBjb3Zlcn0pID0+IHtcbiAgICBjb25zdCBmaWxlTmFtZSA9IHRoaXMucmVwb3J0c0ZpbGVOYW1lID09PSAndGl0bGUnID8gcmVjb3JkLmRpc3BsYXlWYWx1ZSB8fCByZWNvcmQuaWQgOiByZWNvcmQuaWQ7XG5cbiAgICBjb25zdCBvdXRwdXRGaWxlTmFtZSA9IHBhdGguam9pbih0aGlzLnJlcG9ydFBhdGgsIGZpbGVOYW1lICsgJy5wZGYnKTtcblxuICAgIGlmIChmcy5leGlzdHNTeW5jKG91dHB1dEZpbGVOYW1lKSAmJiBmcy5zdGF0U3luYyhvdXRwdXRGaWxlTmFtZSkuc2l6ZSA+IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBwYXJhbXMgPSB7XG4gICAgICByZXBvcnROYW1lOiBmaWxlTmFtZSxcbiAgICAgIGRpcmVjdG9yeTogdGhpcy5yZXBvcnRQYXRoLFxuICAgICAgdGVtcGxhdGU6IHRlbXBsYXRlIHx8IHRoaXMudGVtcGxhdGUsXG4gICAgICBoZWFkZXI6IGhlYWRlciB8fCB0aGlzLmhlYWRlcixcbiAgICAgIGZvb3RlcjogZm9vdGVyIHx8IHRoaXMuZm9vdGVyLFxuICAgICAgY292ZXIsXG4gICAgICBkYXRhOiB7XG4gICAgICAgIERhdGVVdGlsczogY29yZS5EYXRlVXRpbHMsXG4gICAgICAgIHJlY29yZDogcmVjb3JkLFxuICAgICAgICByZW5kZXJWYWx1ZXM6IHRoaXMucmVuZGVyVmFsdWVzLFxuICAgICAgICBnZXRQaG90b1VSTDogdGhpcy5nZXRQaG90b1VSTFxuICAgICAgfSxcbiAgICAgIGVqc09wdGlvbnM6IHt9LFxuICAgICAgcmVwb3J0T3B0aW9uczoge1xuICAgICAgICB3a2h0bWx0b3BkZjogZnVsY3J1bS5hcmdzLnJlcG9ydHNXa2h0bWx0b3BkZlxuICAgICAgfVxuICAgIH07XG5cbiAgICBhd2FpdCB0aGlzLmdlbmVyYXRlUERGKHBhcmFtcyk7XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLnJlcG9ydHNSZXBlYXRhYmxlcykge1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHJlY29yZC5mb3JtVmFsdWVzLnJlcGVhdGFibGVJdGVtcykge1xuICAgICAgICBjb25zdCByZXBlYXRhYmxlRmlsZU5hbWUgPSB0aGlzLnJlcG9ydHNGaWxlTmFtZSA9PT0gJ3RpdGxlJyA/IGAke2ZpbGVOYW1lfSAtICR7aXRlbS5kaXNwbGF5VmFsdWV9YCA6IGl0ZW0uaWQ7XG5cbiAgICAgICAgcGFyYW1zLnJlcG9ydE5hbWUgPSByZXBlYXRhYmxlRmlsZU5hbWU7XG4gICAgICAgIHBhcmFtcy5kYXRhLnJlY29yZCA9IGl0ZW07XG5cbiAgICAgICAgYXdhaXQgdGhpcy5nZW5lcmF0ZVBERihwYXJhbXMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdlbmVyYXRlUERGKHBhcmFtcykge1xuICAgIGNvbnNvbGUubG9nKCdHZW5lcmF0aW5nJywgcGFyYW1zLmRhdGEucmVjb3JkLmlzUmVjb3JkID8gJ3JlY29yZCcuZ3JlZW4gOiAnY2hpbGQgcmVjb3JkJy5ncmVlbiwgcGFyYW1zLnJlcG9ydE5hbWUpO1xuICAgIHJldHVybiBhd2FpdCBSZXBvcnRHZW5lcmF0b3IuZ2VuZXJhdGUocGFyYW1zKTtcbiAgfVxuXG4gIGdldFBob3RvVVJMID0gKGl0ZW0pID0+IHtcbiAgICBpZiAoZnVsY3J1bS5hcmdzLnJlcG9ydHNNZWRpYVBhdGgpIHtcbiAgICAgIHJldHVybiBwYXRoLmpvaW4oZnVsY3J1bS5hcmdzLnJlcG9ydHNNZWRpYVBhdGgsICdwaG90b3MnLCBpdGVtLm1lZGlhSUQgKyAnLmpwZycpO1xuICAgIH1cblxuICAgIGNvbnN0IHVybCA9IEFQSUNsaWVudC5nZXRQaG90b1VSTCh0aGlzLmFjY291bnQsIHtpZDogaXRlbS5tZWRpYUlEfSkucmVwbGFjZSgnPycsICcvbGFyZ2U/Jyk7XG5cbiAgICBpZiAodXJsLmluZGV4T2YoJy5qcGcnKSA9PT0gLTEpIHtcbiAgICAgIHJldHVybiB1cmwucmVwbGFjZSgnPycsICcuanBnPycpO1xuICAgIH1cblxuICAgIHJldHVybiB1cmw7XG4gIH1cblxuICByZW5kZXJWYWx1ZXMgPSAoZmVhdHVyZSwgcmVuZGVyRnVuY3Rpb24pID0+IHtcbiAgICByZXR1cm4gdGhpcy5yZW5kZXJWYWx1ZXNSZWN1cnNpdmUoZmVhdHVyZSwgZmVhdHVyZS5mb3JtVmFsdWVzLmNvbnRhaW5lci5lbGVtZW50cywgcmVuZGVyRnVuY3Rpb24pO1xuICB9XG5cbiAgcmVuZGVyVmFsdWVzUmVjdXJzaXZlID0gKGZlYXR1cmUsIGVsZW1lbnRzLCByZW5kZXJGdW5jdGlvbikgPT4ge1xuICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiBlbGVtZW50cykge1xuICAgICAgY29uc3QgZm9ybVZhbHVlID0gZmVhdHVyZS5mb3JtVmFsdWVzLmdldChlbGVtZW50LmtleSk7XG5cbiAgICAgIHJlbmRlckZ1bmN0aW9uKGVsZW1lbnQsIGZvcm1WYWx1ZSk7XG5cbiAgICAgIGlmIChlbGVtZW50LmlzU2VjdGlvbkVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5yZW5kZXJWYWx1ZXNSZWN1cnNpdmUoZmVhdHVyZSwgZWxlbWVudC5lbGVtZW50cywgcmVuZGVyRnVuY3Rpb24pO1xuICAgICAgfSBlbHNlIGlmIChlbGVtZW50LmlzUmVwZWF0YWJsZUVsZW1lbnQpIHtcbiAgICAgICAgbGV0IHNob3VsZFJlY3Vyc2UgPSB0cnVlO1xuXG4gICAgICAgIGlmIChlbGVtZW50LmlzUmVwZWF0YWJsZUVsZW1lbnQgJiYgZnVsY3J1bS5hcmdzLnJlcG9ydHNSZWN1cnNlID09PSBmYWxzZSkge1xuICAgICAgICAgIHNob3VsZFJlY3Vyc2UgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmb3JtVmFsdWUgJiYgc2hvdWxkUmVjdXJzZSkge1xuICAgICAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBmb3JtVmFsdWUuaXRlbXMpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyVmFsdWVzUmVjdXJzaXZlKGl0ZW0sIGVsZW1lbnQuZWxlbWVudHMsIHJlbmRlckZ1bmN0aW9uKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==