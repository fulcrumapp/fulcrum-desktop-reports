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

var _wkhtmltopdfInstaller = require('wkhtmltopdf-installer');

var _wkhtmltopdfInstaller2 = _interopRequireDefault(_wkhtmltopdfInstaller);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

exports.default = class {
  constructor() {
    var _this = this;

    this.runCommand = _asyncToGenerator(function* () {
      yield _this.activate();

      const account = yield fulcrum.fetchAccount(fulcrum.args.org);

      const skipForms = fulcrum.args.skip || [];
      const includeForms = fulcrum.args.form != null ? fulcrum.args.form : null;

      if (account) {
        _this.account = account;

        const forms = yield account.findForms({});

        const concurrency = Math.min(Math.max(1, fulcrum.args.concurrency || 5), 50);

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
        const fileName = _this.fileName === 'title' ? record.displayValue || record.id : record.id;

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
            wkhtmltopdf: _wkhtmltopdfInstaller2.default.path
          }
        };

        yield _this.generatePDF(params);

        if (fulcrum.args.repeatables) {
          for (const item of record.formValues.repeatableItems) {
            const repeatableFileName = _this.fileName === 'title' ? `${fileName} - ${item.displayValue}` : item.id;

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
      if (fulcrum.args.mediaPath) {
        return _path2.default.join(fulcrum.args.mediaPath, 'photos', item.mediaID + '.jpg');
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

          if (element.isRepeatableElement && fulcrum.args.recurse === false) {
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
          skip: {
            desc: 'skip form name',
            type: 'array'
          },
          template: {
            desc: 'path to ejs template file',
            type: 'string'
          },
          header: {
            desc: 'path to header ejs template file',
            type: 'string'
          },
          footer: {
            desc: 'path to footer ejs template file',
            type: 'string'
          },
          reportPath: {
            desc: 'report storage directory',
            type: 'string'
          },
          mediaPath: {
            desc: 'media storage directory',
            type: 'string'
          },
          fileName: {
            desc: 'file name',
            type: 'string'
          },
          concurrency: {
            desc: 'concurrent reports (between 1 and 10)',
            type: 'number',
            default: 5
          },
          repeatables: {
            desc: 'generate a PDF for each repeatable child record',
            type: 'boolean',
            default: false
          },
          recurse: {
            desc: 'recursively print all child items in each PDF',
            type: 'boolean',
            default: true
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

      if (fulcrum.args.header) {
        _this3.header = _fs2.default.readFileSync(fulcrum.args.header).toString();
      }

      if (fulcrum.args.footer) {
        _this3.footer = _fs2.default.readFileSync(fulcrum.args.footer).toString();
      }

      _this3.reportPath = fulcrum.args.reportPath || fulcrum.dir('reports');
      _this3.fileName = fulcrum.args.fileName === 'title' ? 'title' : 'id';

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJydW5Db21tYW5kIiwiYWN0aXZhdGUiLCJhY2NvdW50IiwiZnVsY3J1bSIsImZldGNoQWNjb3VudCIsImFyZ3MiLCJvcmciLCJza2lwRm9ybXMiLCJza2lwIiwiaW5jbHVkZUZvcm1zIiwiZm9ybSIsImZvcm1zIiwiZmluZEZvcm1zIiwiY29uY3VycmVuY3kiLCJNYXRoIiwibWluIiwibWF4IiwicXVldWUiLCJ3b3JrZXJGdW5jdGlvbiIsImluZGV4T2YiLCJuYW1lIiwiZmluZEVhY2hSZWNvcmQiLCJyZWNvcmQiLCJwdXNoIiwiaWQiLCJyb3dJRCIsImRyYWluIiwiY29uc29sZSIsImVycm9yIiwidGFzayIsImZpbmRGaXJzdFJlY29yZCIsImdldEZvcm0iLCJydW5SZXBvcnQiLCJlcnIiLCJvblJlY29yZFNhdmUiLCJ0ZW1wbGF0ZSIsImhlYWRlciIsImZvb3RlciIsImNvdmVyIiwiZmlsZU5hbWUiLCJkaXNwbGF5VmFsdWUiLCJvdXRwdXRGaWxlTmFtZSIsImpvaW4iLCJyZXBvcnRQYXRoIiwiZXhpc3RzU3luYyIsInN0YXRTeW5jIiwic2l6ZSIsInBhcmFtcyIsInJlcG9ydE5hbWUiLCJkaXJlY3RvcnkiLCJkYXRhIiwiRGF0ZVV0aWxzIiwicmVuZGVyVmFsdWVzIiwiZ2V0UGhvdG9VUkwiLCJlanNPcHRpb25zIiwicmVwb3J0T3B0aW9ucyIsIndraHRtbHRvcGRmIiwicGF0aCIsImdlbmVyYXRlUERGIiwicmVwZWF0YWJsZXMiLCJpdGVtIiwiZm9ybVZhbHVlcyIsInJlcGVhdGFibGVJdGVtcyIsInJlcGVhdGFibGVGaWxlTmFtZSIsIm1lZGlhUGF0aCIsIm1lZGlhSUQiLCJ1cmwiLCJyZXBsYWNlIiwiZmVhdHVyZSIsInJlbmRlckZ1bmN0aW9uIiwicmVuZGVyVmFsdWVzUmVjdXJzaXZlIiwiY29udGFpbmVyIiwiZWxlbWVudHMiLCJlbGVtZW50IiwiZm9ybVZhbHVlIiwiZ2V0Iiwia2V5IiwiaXNTZWN0aW9uRWxlbWVudCIsImlzUmVwZWF0YWJsZUVsZW1lbnQiLCJzaG91bGRSZWN1cnNlIiwicmVjdXJzZSIsIml0ZW1zIiwiY2xpIiwiY29tbWFuZCIsImRlc2MiLCJidWlsZGVyIiwicmVxdWlyZWQiLCJ0eXBlIiwiZGVmYXVsdCIsImhhbmRsZXIiLCJ0ZW1wbGF0ZUZpbGUiLCJfX2Rpcm5hbWUiLCJyZWFkRmlsZVN5bmMiLCJ0b1N0cmluZyIsImRpciIsInN5bmMiLCJsb2ciLCJpc1JlY29yZCIsImdyZWVuIiwiZ2VuZXJhdGUiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOztBQUNBOzs7O0FBQ0E7Ozs7Ozs7O2tCQUVlLE1BQU07QUFBQTtBQUFBOztBQUFBLFNBK0RuQkEsVUEvRG1CLHFCQStETixhQUFZO0FBQ3ZCLFlBQU0sTUFBS0MsUUFBTCxFQUFOOztBQUVBLFlBQU1DLFVBQVUsTUFBTUMsUUFBUUMsWUFBUixDQUFxQkQsUUFBUUUsSUFBUixDQUFhQyxHQUFsQyxDQUF0Qjs7QUFFQSxZQUFNQyxZQUFZSixRQUFRRSxJQUFSLENBQWFHLElBQWIsSUFBcUIsRUFBdkM7QUFDQSxZQUFNQyxlQUFlTixRQUFRRSxJQUFSLENBQWFLLElBQWIsSUFBcUIsSUFBckIsR0FBNEJQLFFBQVFFLElBQVIsQ0FBYUssSUFBekMsR0FBZ0QsSUFBckU7O0FBRUEsVUFBSVIsT0FBSixFQUFhO0FBQ1gsY0FBS0EsT0FBTCxHQUFlQSxPQUFmOztBQUVBLGNBQU1TLFFBQVEsTUFBTVQsUUFBUVUsU0FBUixDQUFrQixFQUFsQixDQUFwQjs7QUFFQSxjQUFNQyxjQUFjQyxLQUFLQyxHQUFMLENBQVNELEtBQUtFLEdBQUwsQ0FBUyxDQUFULEVBQVliLFFBQVFFLElBQVIsQ0FBYVEsV0FBYixJQUE0QixDQUF4QyxDQUFULEVBQXFELEVBQXJELENBQXBCOztBQUVBLGNBQUtJLEtBQUwsR0FBYSw4QkFBb0IsTUFBS0MsY0FBekIsRUFBeUNMLFdBQXpDLENBQWI7O0FBRUEsYUFBSyxNQUFN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LFlBQUgsQ0FBZ0J6RixRQUFRRSxJQUFSLENBQWErQixNQUE3QixFQUFxQ3lELFFBQXJDLEVBQWQ7QUFDRDs7QUFFRCxVQUFJMUYsUUFBUUUsSUFBUixDQUFhZ0MsTUFBakIsRUFBeUI7QUFDdkIsZUFBS0EsTUFBTCxHQUFjLGFBQUd1RCxZQUFILENBQWdCekYsUUFBUUUsSUFBUixDQUFhZ0MsTUFBN0IsRUFBcUN3RCxRQUFyQyxFQUFkO0FBQ0Q7O0FBRUQsYUFBS2xELFVBQUwsR0FBa0J4QyxRQUFRRSxJQUFSLENBQWFzQyxVQUFiLElBQTJCeEMsUUFBUTJGLEdBQVIsQ0FBWSxTQUFaLENBQTdDO0FBQ0EsYUFBS3ZELFFBQUwsR0FBZ0JwQyxRQUFRRSxJQUFSLENBQWFrQyxRQUFiLEtBQTBCLE9BQTFCLEdBQW9DLE9BQXBDLEdBQThDLElBQTlEOztBQUVBLHVCQUFPd0QsSUFBUCxDQUFZLE9BQUtwRCxVQUFqQjtBQUNBO0FBakJlO0FBa0JoQjs7QUE0REtlLGFBQU4sQ0FBa0JYLE1BQWxCLEVBQTBCO0FBQUE7QUFDeEJwQixjQUFRcUUsR0FBUixDQUFZLFlBQVosRUFBMEJqRCxPQUFPRyxJQUFQLENBQVk1QixNQUFaLENBQW1CMkUsUUFBbkIsR0FBOEIsU0FBU0MsS0FBdkMsR0FBK0MsZUFBZUEsS0FBeEYsRUFBK0ZuRCxPQUFPQyxVQUF0RztBQUNBLGFBQU8sTUFBTSxzQ0FBZ0JtRCxRQUFoQixDQUF5QnBELE1BQXpCLENBQWI7QUFGd0I7QUFHekI7O0FBdExrQixDIiwiZmlsZSI6InBsdWdpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBta2RpcnAgZnJvbSAnbWtkaXJwJztcbmltcG9ydCB7IFJlcG9ydEdlbmVyYXRvciwgQVBJQ2xpZW50LCBjb3JlIH0gZnJvbSAnZnVsY3J1bSc7XG5pbXBvcnQgQ29uY3VycmVudFF1ZXVlIGZyb20gJy4vY29uY3VycmVudC1xdWV1ZSc7XG5pbXBvcnQgd2todG1sdG9wZGYgZnJvbSAnd2todG1sdG9wZGYtaW5zdGFsbGVyJztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3Mge1xuICBhc3luYyB0YXNrKGNsaSkge1xuICAgIHJldHVybiBjbGkuY29tbWFuZCh7XG4gICAgICBjb21tYW5kOiAncmVwb3J0cycsXG4gICAgICBkZXNjOiAncnVuIHRoZSBwZGYgcmVwb3J0cyBzeW5jIGZvciBhIHNwZWNpZmljIG9yZ2FuaXphdGlvbicsXG4gICAgICBidWlsZGVyOiB7XG4gICAgICAgIG9yZzoge1xuICAgICAgICAgIGRlc2M6ICdvcmdhbml6YXRpb24gbmFtZScsXG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgZm9ybToge1xuICAgICAgICAgIGRlc2M6ICdmb3JtIG5hbWUnLFxuICAgICAgICAgIHR5cGU6ICdhcnJheSdcbiAgICAgICAgfSxcbiAgICAgICAgc2tpcDoge1xuICAgICAgICAgIGRlc2M6ICdza2lwIGZvcm0gbmFtZScsXG4gICAgICAgICAgdHlwZTogJ2FycmF5J1xuICAgICAgICB9LFxuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIGRlc2M6ICdwYXRoIHRvIGVqcyB0ZW1wbGF0ZSBmaWxlJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBoZWFkZXI6IHtcbiAgICAgICAgICBkZXNjOiAncGF0aCB0byBoZWFkZXIgZWpzIHRlbXBsYXRlIGZpbGUnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIGZvb3Rlcjoge1xuICAgICAgICAgIGRlc2M6ICdwYXRoIHRvIGZvb3RlciBlanMgdGVtcGxhdGUgZmlsZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgcmVwb3J0UGF0aDoge1xuICAgICAgICAgIGRlc2M6ICdyZXBvcnQgc3RvcmFnZSBkaXJlY3RvcnknLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIG1lZGlhUGF0aDoge1xuICAgICAgICAgIGRlc2M6ICdtZWRpYSBzdG9yYWdlIGRpcmVjdG9yeScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgZmlsZU5hbWU6IHtcbiAgICAgICAgICBkZXNjOiAnZmlsZSBuYW1lJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBjb25jdXJyZW5jeToge1xuICAgICAgICAgIGRlc2M6ICdjb25jdXJyZW50IHJlcG9ydHMgKGJldHdlZW4gMSBhbmQgMTApJyxcbiAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICBkZWZhdWx0OiA1XG4gICAgICAgIH0sXG4gICAgICAgIHJlcGVhdGFibGVzOiB7XG4gICAgICAgICAgZGVzYzogJ2dlbmVyYXRlIGEgUERGIGZvciBlYWNoIHJlcGVhdGFibGUgY2hpbGQgcmVjb3JkJyxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgfSxcbiAgICAgICAgcmVjdXJzZToge1xuICAgICAgICAgIGRlc2M6ICdyZWN1cnNpdmVseSBwcmludCBhbGwgY2hpbGQgaXRlbXMgaW4gZWFjaCBQREYnLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBoYW5kbGVyOiB0aGlzLnJ1bkNvbW1hbmRcbiAgICB9KTtcbiAgfVxuXG4gIHJ1bkNvbW1hbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgdGhpcy5hY3RpdmF0ZSgpO1xuXG4gICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGZ1bGNydW0uZmV0Y2hBY2NvdW50KGZ1bGNydW0uYXJncy5vcmcpO1xuXG4gICAgY29uc3Qgc2tpcEZvcm1zID0gZnVsY3J1bS5hcmdzLnNraXAgfHwgW107XG4gICAgY29uc3QgaW5jbHVkZUZvcm1zID0gZnVsY3J1bS5hcmdzLmZvcm0gIT0gbnVsbCA/IGZ1bGNydW0uYXJncy5mb3JtIDogbnVsbDtcblxuICAgIGlmIChhY2NvdW50KSB7XG4gICAgICB0aGlzLmFjY291bnQgPSBhY2NvdW50O1xuXG4gICAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEZvcm1zKHt9KTtcblxuICAgICAgY29uc3QgY29uY3VycmVuY3kgPSBNYXRoLm1pbihNYXRoLm1heCgxLCBmdWxjcnVtLmFyZ3MuY29uY3VycmVuY3kgfHwgNSksIDUwKTtcblxuICAgICAgdGhpcy5xdWV1ZSA9IG5ldyBDb25jdXJyZW50UXVldWUodGhpcy53b3JrZXJGdW5jdGlvbiwgY29uY3VycmVuY3kpO1xuXG4gICAgICBmb3IgKGNvbnN0IGZvcm0gb2YgZm9ybXMpIHtcbiAgICAgICAgaWYgKHNraXBGb3Jtcy5pbmRleE9mKGZvcm0ubmFtZSkgPiAtMSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluY2x1ZGVGb3JtcyAmJiBpbmNsdWRlRm9ybXMuaW5kZXhPZihmb3JtLm5hbWUpID09PSAtMSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgZm9ybS5maW5kRWFjaFJlY29yZCh7fSwgYXN5bmMgKHJlY29yZCkgPT4ge1xuICAgICAgICAgIHRoaXMucXVldWUucHVzaCh7aWQ6IHJlY29yZC5yb3dJRH0pO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy5xdWV1ZS5kcmFpbigpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuYWJsZSB0byBmaW5kIGFjY291bnQnLCBmdWxjcnVtLmFyZ3Mub3JnKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBhY3RpdmF0ZSgpIHtcbiAgICBjb25zdCB0ZW1wbGF0ZUZpbGUgPSBmdWxjcnVtLmFyZ3MudGVtcGxhdGUgfHwgcGF0aC5qb2luKF9fZGlybmFtZSwgJ3RlbXBsYXRlLmVqcycpO1xuXG4gICAgdGhpcy50ZW1wbGF0ZSA9IGZzLnJlYWRGaWxlU3luYyh0ZW1wbGF0ZUZpbGUpLnRvU3RyaW5nKCk7XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLmhlYWRlcikge1xuICAgICAgdGhpcy5oZWFkZXIgPSBmcy5yZWFkRmlsZVN5bmMoZnVsY3J1bS5hcmdzLmhlYWRlcikudG9TdHJpbmcoKTtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLmZvb3Rlcikge1xuICAgICAgdGhpcy5mb290ZXIgPSBmcy5yZWFkRmlsZVN5bmMoZnVsY3J1bS5hcmdzLmZvb3RlcikudG9TdHJpbmcoKTtcbiAgICB9XG5cbiAgICB0aGlzLnJlcG9ydFBhdGggPSBmdWxjcnVtLmFyZ3MucmVwb3J0UGF0aCB8fCBmdWxjcnVtLmRpcigncmVwb3J0cycpO1xuICAgIHRoaXMuZmlsZU5hbWUgPSBmdWxjcnVtLmFyZ3MuZmlsZU5hbWUgPT09ICd0aXRsZScgPyAndGl0bGUnIDogJ2lkJztcblxuICAgIG1rZGlycC5zeW5jKHRoaXMucmVwb3J0UGF0aCk7XG4gICAgLy8gZnVsY3J1bS5vbigncmVjb3JkOnNhdmUnLCB0aGlzLm9uUmVjb3JkU2F2ZSk7XG4gIH1cblxuICB3b3JrZXJGdW5jdGlvbiA9IGFzeW5jICh0YXNrKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlY29yZCA9IGF3YWl0IHRoaXMuYWNjb3VudC5maW5kRmlyc3RSZWNvcmQoe2lkOiB0YXNrLmlkfSk7XG5cbiAgICAgIGF3YWl0IHJlY29yZC5nZXRGb3JtKCk7XG5cbiAgICAgIGF3YWl0IHRoaXMucnVuUmVwb3J0KHtyZWNvcmR9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yJywgZXJyKTtcbiAgICB9XG4gIH1cblxuICBvblJlY29yZFNhdmUgPSBhc3luYyAoe3JlY29yZH0pID0+IHtcbiAgICB0aGlzLnJ1blJlcG9ydCh7cmVjb3JkfSk7XG4gIH1cblxuICBydW5SZXBvcnQgPSBhc3luYyAoe3JlY29yZCwgdGVtcGxhdGUsIGhlYWRlciwgZm9vdGVyLCBjb3Zlcn0pID0+IHtcbiAgICBjb25zdCBmaWxlTmFtZSA9IHRoaXMuZmlsZU5hbWUgPT09ICd0aXRsZScgPyByZWNvcmQuZGlzcGxheVZhbHVlIHx8IHJlY29yZC5pZCA6IHJlY29yZC5pZDtcblxuICAgIGNvbnN0IG91dHB1dEZpbGVOYW1lID0gcGF0aC5qb2luKHRoaXMucmVwb3J0UGF0aCwgZmlsZU5hbWUgKyAnLnBkZicpO1xuXG4gICAgaWYgKGZzLmV4aXN0c1N5bmMob3V0cHV0RmlsZU5hbWUpICYmIGZzLnN0YXRTeW5jKG91dHB1dEZpbGVOYW1lKS5zaXplID4gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHBhcmFtcyA9IHtcbiAgICAgIHJlcG9ydE5hbWU6IGZpbGVOYW1lLFxuICAgICAgZGlyZWN0b3J5OiB0aGlzLnJlcG9ydFBhdGgsXG4gICAgICB0ZW1wbGF0ZTogdGVtcGxhdGUgfHwgdGhpcy50ZW1wbGF0ZSxcbiAgICAgIGhlYWRlcjogaGVhZGVyIHx8IHRoaXMuaGVhZGVyLFxuICAgICAgZm9vdGVyOiBmb290ZXIgfHwgdGhpcy5mb290ZXIsXG4gICAgICBjb3ZlcixcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgRGF0ZVV0aWxzOiBjb3JlLkRhdGVVdGlscyxcbiAgICAgICAgcmVjb3JkOiByZWNvcmQsXG4gICAgICAgIHJlbmRlclZhbHVlczogdGhpcy5yZW5kZXJWYWx1ZXMsXG4gICAgICAgIGdldFBob3RvVVJMOiB0aGlzLmdldFBob3RvVVJMXG4gICAgICB9LFxuICAgICAgZWpzT3B0aW9uczoge30sXG4gICAgICByZXBvcnRPcHRpb25zOiB7XG4gICAgICAgIHdraHRtbHRvcGRmOiB3a2h0bWx0b3BkZi5wYXRoXG4gICAgICB9XG4gICAgfTtcblxuICAgIGF3YWl0IHRoaXMuZ2VuZXJhdGVQREYocGFyYW1zKTtcblxuICAgIGlmIChmdWxjcnVtLmFyZ3MucmVwZWF0YWJsZXMpIHtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiByZWNvcmQuZm9ybVZhbHVlcy5yZXBlYXRhYmxlSXRlbXMpIHtcbiAgICAgICAgY29uc3QgcmVwZWF0YWJsZUZpbGVOYW1lID0gdGhpcy5maWxlTmFtZSA9PT0gJ3RpdGxlJyA/IGAke2ZpbGVOYW1lfSAtICR7aXRlbS5kaXNwbGF5VmFsdWV9YCA6IGl0ZW0uaWQ7XG5cbiAgICAgICAgcGFyYW1zLnJlcG9ydE5hbWUgPSByZXBlYXRhYmxlRmlsZU5hbWU7XG4gICAgICAgIHBhcmFtcy5kYXRhLnJlY29yZCA9IGl0ZW07XG5cbiAgICAgICAgYXdhaXQgdGhpcy5nZW5lcmF0ZVBERihwYXJhbXMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdlbmVyYXRlUERGKHBhcmFtcykge1xuICAgIGNvbnNvbGUubG9nKCdHZW5lcmF0aW5nJywgcGFyYW1zLmRhdGEucmVjb3JkLmlzUmVjb3JkID8gJ3JlY29yZCcuZ3JlZW4gOiAnY2hpbGQgcmVjb3JkJy5ncmVlbiwgcGFyYW1zLnJlcG9ydE5hbWUpO1xuICAgIHJldHVybiBhd2FpdCBSZXBvcnRHZW5lcmF0b3IuZ2VuZXJhdGUocGFyYW1zKTtcbiAgfVxuXG4gIGdldFBob3RvVVJMID0gKGl0ZW0pID0+IHtcbiAgICBpZiAoZnVsY3J1bS5hcmdzLm1lZGlhUGF0aCkge1xuICAgICAgcmV0dXJuIHBhdGguam9pbihmdWxjcnVtLmFyZ3MubWVkaWFQYXRoLCAncGhvdG9zJywgaXRlbS5tZWRpYUlEICsgJy5qcGcnKTtcbiAgICB9XG5cbiAgICBjb25zdCB1cmwgPSBBUElDbGllbnQuZ2V0UGhvdG9VUkwodGhpcy5hY2NvdW50LCB7aWQ6IGl0ZW0ubWVkaWFJRH0pLnJlcGxhY2UoJz8nLCAnL2xhcmdlPycpO1xuXG4gICAgaWYgKHVybC5pbmRleE9mKCcuanBnJykgPT09IC0xKSB7XG4gICAgICByZXR1cm4gdXJsLnJlcGxhY2UoJz8nLCAnLmpwZz8nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdXJsO1xuICB9XG5cbiAgcmVuZGVyVmFsdWVzID0gKGZlYXR1cmUsIHJlbmRlckZ1bmN0aW9uKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMucmVuZGVyVmFsdWVzUmVjdXJzaXZlKGZlYXR1cmUsIGZlYXR1cmUuZm9ybVZhbHVlcy5jb250YWluZXIuZWxlbWVudHMsIHJlbmRlckZ1bmN0aW9uKTtcbiAgfVxuXG4gIHJlbmRlclZhbHVlc1JlY3Vyc2l2ZSA9IChmZWF0dXJlLCBlbGVtZW50cywgcmVuZGVyRnVuY3Rpb24pID0+IHtcbiAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZWxlbWVudHMpIHtcbiAgICAgIGNvbnN0IGZvcm1WYWx1ZSA9IGZlYXR1cmUuZm9ybVZhbHVlcy5nZXQoZWxlbWVudC5rZXkpO1xuXG4gICAgICByZW5kZXJGdW5jdGlvbihlbGVtZW50LCBmb3JtVmFsdWUpO1xuXG4gICAgICBpZiAoZWxlbWVudC5pc1NlY3Rpb25FbGVtZW50KSB7XG4gICAgICAgIHRoaXMucmVuZGVyVmFsdWVzUmVjdXJzaXZlKGZlYXR1cmUsIGVsZW1lbnQuZWxlbWVudHMsIHJlbmRlckZ1bmN0aW9uKTtcbiAgICAgIH0gZWxzZSBpZiAoZWxlbWVudC5pc1JlcGVhdGFibGVFbGVtZW50KSB7XG4gICAgICAgIGxldCBzaG91bGRSZWN1cnNlID0gdHJ1ZTtcblxuICAgICAgICBpZiAoZWxlbWVudC5pc1JlcGVhdGFibGVFbGVtZW50ICYmIGZ1bGNydW0uYXJncy5yZWN1cnNlID09PSBmYWxzZSkge1xuICAgICAgICAgIHNob3VsZFJlY3Vyc2UgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmb3JtVmFsdWUgJiYgc2hvdWxkUmVjdXJzZSkge1xuICAgICAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBmb3JtVmFsdWUuaXRlbXMpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyVmFsdWVzUmVjdXJzaXZlKGl0ZW0sIGVsZW1lbnQuZWxlbWVudHMsIHJlbmRlckZ1bmN0aW9uKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==