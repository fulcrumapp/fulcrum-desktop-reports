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

      const skipForms = fulcrum.args.skip || [];

      if (account) {
        _this.account = account;

        const forms = yield account.findForms({});

        const concurrency = Math.min(Math.max(1, fulcrum.args.concurrency || 5), 50);

        _this.queue = new _concurrentQueue2.default(_this.workerFunction, concurrency);

        for (const form of forms) {
          if (skipForms.indexOf(form.name) > -1) {
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
          ejsOptions: {}
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
            type: 'string'
          },
          skip: {
            desc: 'skip form name',
            type: 'string'
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJydW5Db21tYW5kIiwiYWN0aXZhdGUiLCJhY2NvdW50IiwiZnVsY3J1bSIsImZldGNoQWNjb3VudCIsImFyZ3MiLCJvcmciLCJza2lwRm9ybXMiLCJza2lwIiwiZm9ybXMiLCJmaW5kRm9ybXMiLCJjb25jdXJyZW5jeSIsIk1hdGgiLCJtaW4iLCJtYXgiLCJxdWV1ZSIsIndvcmtlckZ1bmN0aW9uIiwiZm9ybSIsImluZGV4T2YiLCJuYW1lIiwiZmluZEVhY2hSZWNvcmQiLCJyZWNvcmQiLCJwdXNoIiwiaWQiLCJyb3dJRCIsImRyYWluIiwiY29uc29sZSIsImVycm9yIiwidGFzayIsImZpbmRGaXJzdFJlY29yZCIsImdldEZvcm0iLCJydW5SZXBvcnQiLCJlcnIiLCJvblJlY29yZFNhdmUiLCJ0ZW1wbGF0ZSIsImhlYWRlciIsImZvb3RlciIsImNvdmVyIiwiZmlsZU5hbWUiLCJkaXNwbGF5VmFsdWUiLCJvdXRwdXRGaWxlTmFtZSIsImpvaW4iLCJyZXBvcnRQYXRoIiwiZXhpc3RzU3luYyIsInN0YXRTeW5jIiwic2l6ZSIsInBhcmFtcyIsInJlcG9ydE5hbWUiLCJkaXJlY3RvcnkiLCJkYXRhIiwiRGF0ZVV0aWxzIiwicmVuZGVyVmFsdWVzIiwiZ2V0UGhvdG9VUkwiLCJlanNPcHRpb25zIiwiZ2VuZXJhdGVQREYiLCJyZXBlYXRhYmxlcyIsIml0ZW0iLCJmb3JtVmFsdWVzIiwicmVwZWF0YWJsZUl0ZW1zIiwicmVwZWF0YWJsZUZpbGVOYW1lIiwibWVkaWFQYXRoIiwibWVkaWFJRCIsInVybCIsInJlcGxhY2UiLCJmZWF0dXJlIiwicmVuZGVyRnVuY3Rpb24iLCJyZW5kZXJWYWx1ZXNSZWN1cnNpdmUiLCJjb250YWluZXIiLCJlbGVtZW50cyIsImVsZW1lbnQiLCJmb3JtVmFsdWUiLCJnZXQiLCJrZXkiLCJpc1NlY3Rpb25FbGVtZW50IiwiaXNSZXBlYXRhYmxlRWxlbWVudCIsInNob3VsZFJlY3Vyc2UiLCJyZWN1cnNlIiwiaXRlbXMiLCJjbGkiLCJjb21tYW5kIiwiZGVzYyIsImJ1aWxkZXIiLCJyZXF1aXJlZCIsInR5cGUiLCJkZWZhdWx0IiwiaGFuZGxlciIsInRlbXBsYXRlRmlsZSIsIl9fZGlybmFtZSIsInJlYWRGaWxlU3luYyIsInRvU3RyaW5nIiwiZGlyIiwic3luYyIsImxvZyIsImlzUmVjb3JkIiwiZ3JlZW4iLCJnZW5lcmF0ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7O0FBQ0E7Ozs7Ozs7O2tCQUVlLE1BQU07QUFBQTtBQUFBOztBQUFBLFNBK0RuQkEsVUEvRG1CLHFCQStETixhQUFZO0FBQ3ZCLFlBQU0sTUFBS0MsUUFBTCxFQUFOOztBQUVBLFlBQU1DLFVBQVUsTUFBTUMsUUFBUUMsWUFBUixDQUFxQkQsUUFBUUUsSUFBUixDQUFhQyxHQUFsQyxDQUF0Qjs7QUFFQSxZQUFNQyxZQUFZSixRQUFRRSxJQUFSLENBQWFHLElBQWIsSUFBcUIsRUFBdkM7O0FBRUEsVUFBSU4sT0FBSixFQUFhO0FBQ1gsY0FBS0EsT0FBTCxHQUFlQSxPQUFmOztBQUVBLGNBQU1PLFFBQVEsTUFBTVAsUUFBUVEsU0FBUixDQUFrQixFQUFsQixDQUFwQjs7QUFFQSxjQUFNQyxjQUFjQyxLQUFLQyxHQUFMLENBQVNELEtBQUtFLEdBQUwsQ0FBUyxDQUFULEVBQVlYLFFBQVFFLElBQVIsQ0FBYU0sV0FBYixJQUE0QixDQUF4QyxDQUFULEVBQXFELEVBQXJELENBQXBCOztBQUVBLGNBQUtJLEtBQUwsR0FBYSw4QkFBb0IsTUFBS0MsY0FBekIsRUFBeUNMLFdBQXpDLENBQWI7O0FBRUEsYUFBSyxNQUFNTSxJQUFYLElBQW1CUixLQUFuQixFQUEwQjtBQUN4QixjQUFJRixVQUFVVyxPQUFWLENBQWtCRCxLQUFLRSxJQUF2QixJQUErQixDQUFDLENBQXBDLEVBQXVDO0FBQ3JDO0FBQ0Q7O0FBRUQsZ0JBQU1GLEtBQUtHLGNBQUwsQ0FBb0IsRUFBcEI7QUFBQSwwQ0FBd0IsV0FB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QUFDQSxhQUFLcEQsUUFBTCxHQUFnQm5DLFFBQVFFLElBQVIsQ0FBYWlDLFFBQWIsS0FBMEIsT0FBMUIsR0FBb0MsT0FBcEMsR0FBOEMsSUFBOUQ7O0FBRUEsdUJBQU9xRCxJQUFQLENBQVksT0FBS2pELFVBQWpCO0FBQ0E7QUFqQmU7QUFrQmhCOztBQXlES1ksYUFBTixDQUFrQlIsTUFBbEIsRUFBMEI7QUFBQTtBQUN4QnBCLGNBQVFrRSxHQUFSLENBQVksWUFBWixFQUEwQjlDLE9BQU9HLElBQVAsQ0FBWTVCLE1BQVosQ0FBbUJ3RSxRQUFuQixHQUE4QixTQUFTQyxLQUF2QyxHQUErQyxlQUFlQSxLQUF4RixFQUErRmhELE9BQU9DLFVBQXRHO0FBQ0EsYUFBTyxNQUFNLHNDQUFnQmdELFFBQWhCLENBQXlCakQsTUFBekIsQ0FBYjtBQUZ3QjtBQUd6Qjs7QUE5S2tCLEMiLCJmaWxlIjoicGx1Z2luLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IG1rZGlycCBmcm9tICdta2RpcnAnO1xuaW1wb3J0IHsgUmVwb3J0R2VuZXJhdG9yLCBBUElDbGllbnQsIGNvcmUgfSBmcm9tICdmdWxjcnVtJztcbmltcG9ydCBDb25jdXJyZW50UXVldWUgZnJvbSAnLi9jb25jdXJyZW50LXF1ZXVlJztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3Mge1xuICBhc3luYyB0YXNrKGNsaSkge1xuICAgIHJldHVybiBjbGkuY29tbWFuZCh7XG4gICAgICBjb21tYW5kOiAncmVwb3J0cycsXG4gICAgICBkZXNjOiAncnVuIHRoZSBwZGYgcmVwb3J0cyBzeW5jIGZvciBhIHNwZWNpZmljIG9yZ2FuaXphdGlvbicsXG4gICAgICBidWlsZGVyOiB7XG4gICAgICAgIG9yZzoge1xuICAgICAgICAgIGRlc2M6ICdvcmdhbml6YXRpb24gbmFtZScsXG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgZm9ybToge1xuICAgICAgICAgIGRlc2M6ICdmb3JtIG5hbWUnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIHNraXA6IHtcbiAgICAgICAgICBkZXNjOiAnc2tpcCBmb3JtIG5hbWUnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgZGVzYzogJ3BhdGggdG8gZWpzIHRlbXBsYXRlIGZpbGUnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIGhlYWRlcjoge1xuICAgICAgICAgIGRlc2M6ICdwYXRoIHRvIGhlYWRlciBlanMgdGVtcGxhdGUgZmlsZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgZm9vdGVyOiB7XG4gICAgICAgICAgZGVzYzogJ3BhdGggdG8gZm9vdGVyIGVqcyB0ZW1wbGF0ZSBmaWxlJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICByZXBvcnRQYXRoOiB7XG4gICAgICAgICAgZGVzYzogJ3JlcG9ydCBzdG9yYWdlIGRpcmVjdG9yeScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgbWVkaWFQYXRoOiB7XG4gICAgICAgICAgZGVzYzogJ21lZGlhIHN0b3JhZ2UgZGlyZWN0b3J5JyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBmaWxlTmFtZToge1xuICAgICAgICAgIGRlc2M6ICdmaWxlIG5hbWUnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIGNvbmN1cnJlbmN5OiB7XG4gICAgICAgICAgZGVzYzogJ2NvbmN1cnJlbnQgcmVwb3J0cyAoYmV0d2VlbiAxIGFuZCAxMCknLFxuICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgIGRlZmF1bHQ6IDVcbiAgICAgICAgfSxcbiAgICAgICAgcmVwZWF0YWJsZXM6IHtcbiAgICAgICAgICBkZXNjOiAnZ2VuZXJhdGUgYSBQREYgZm9yIGVhY2ggcmVwZWF0YWJsZSBjaGlsZCByZWNvcmQnLFxuICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICB9LFxuICAgICAgICByZWN1cnNlOiB7XG4gICAgICAgICAgZGVzYzogJ3JlY3Vyc2l2ZWx5IHByaW50IGFsbCBjaGlsZCBpdGVtcyBpbiBlYWNoIFBERicsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IHRydWVcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGhhbmRsZXI6IHRoaXMucnVuQ29tbWFuZFxuICAgIH0pO1xuICB9XG5cbiAgcnVuQ29tbWFuZCA9IGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCB0aGlzLmFjdGl2YXRlKCk7XG5cbiAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZnVsY3J1bS5mZXRjaEFjY291bnQoZnVsY3J1bS5hcmdzLm9yZyk7XG5cbiAgICBjb25zdCBza2lwRm9ybXMgPSBmdWxjcnVtLmFyZ3Muc2tpcCB8fCBbXTtcblxuICAgIGlmIChhY2NvdW50KSB7XG4gICAgICB0aGlzLmFjY291bnQgPSBhY2NvdW50O1xuXG4gICAgICBjb25zdCBmb3JtcyA9IGF3YWl0IGFjY291bnQuZmluZEZvcm1zKHt9KTtcblxuICAgICAgY29uc3QgY29uY3VycmVuY3kgPSBNYXRoLm1pbihNYXRoLm1heCgxLCBmdWxjcnVtLmFyZ3MuY29uY3VycmVuY3kgfHwgNSksIDUwKTtcblxuICAgICAgdGhpcy5xdWV1ZSA9IG5ldyBDb25jdXJyZW50UXVldWUodGhpcy53b3JrZXJGdW5jdGlvbiwgY29uY3VycmVuY3kpO1xuXG4gICAgICBmb3IgKGNvbnN0IGZvcm0gb2YgZm9ybXMpIHtcbiAgICAgICAgaWYgKHNraXBGb3Jtcy5pbmRleE9mKGZvcm0ubmFtZSkgPiAtMSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgZm9ybS5maW5kRWFjaFJlY29yZCh7fSwgYXN5bmMgKHJlY29yZCkgPT4ge1xuICAgICAgICAgIHRoaXMucXVldWUucHVzaCh7aWQ6IHJlY29yZC5yb3dJRH0pO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgdGhpcy5xdWV1ZS5kcmFpbigpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuYWJsZSB0byBmaW5kIGFjY291bnQnLCBmdWxjcnVtLmFyZ3Mub3JnKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBhY3RpdmF0ZSgpIHtcbiAgICBjb25zdCB0ZW1wbGF0ZUZpbGUgPSBmdWxjcnVtLmFyZ3MudGVtcGxhdGUgfHwgcGF0aC5qb2luKF9fZGlybmFtZSwgJ3RlbXBsYXRlLmVqcycpO1xuXG4gICAgdGhpcy50ZW1wbGF0ZSA9IGZzLnJlYWRGaWxlU3luYyh0ZW1wbGF0ZUZpbGUpLnRvU3RyaW5nKCk7XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLmhlYWRlcikge1xuICAgICAgdGhpcy5oZWFkZXIgPSBmcy5yZWFkRmlsZVN5bmMoZnVsY3J1bS5hcmdzLmhlYWRlcikudG9TdHJpbmcoKTtcbiAgICB9XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLmZvb3Rlcikge1xuICAgICAgdGhpcy5mb290ZXIgPSBmcy5yZWFkRmlsZVN5bmMoZnVsY3J1bS5hcmdzLmZvb3RlcikudG9TdHJpbmcoKTtcbiAgICB9XG5cbiAgICB0aGlzLnJlcG9ydFBhdGggPSBmdWxjcnVtLmFyZ3MucmVwb3J0UGF0aCB8fCBmdWxjcnVtLmRpcigncmVwb3J0cycpO1xuICAgIHRoaXMuZmlsZU5hbWUgPSBmdWxjcnVtLmFyZ3MuZmlsZU5hbWUgPT09ICd0aXRsZScgPyAndGl0bGUnIDogJ2lkJztcblxuICAgIG1rZGlycC5zeW5jKHRoaXMucmVwb3J0UGF0aCk7XG4gICAgLy8gZnVsY3J1bS5vbigncmVjb3JkOnNhdmUnLCB0aGlzLm9uUmVjb3JkU2F2ZSk7XG4gIH1cblxuICB3b3JrZXJGdW5jdGlvbiA9IGFzeW5jICh0YXNrKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlY29yZCA9IGF3YWl0IHRoaXMuYWNjb3VudC5maW5kRmlyc3RSZWNvcmQoe2lkOiB0YXNrLmlkfSk7XG5cbiAgICAgIGF3YWl0IHJlY29yZC5nZXRGb3JtKCk7XG5cbiAgICAgIGF3YWl0IHRoaXMucnVuUmVwb3J0KHtyZWNvcmR9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yJywgZXJyKTtcbiAgICB9XG4gIH1cblxuICBvblJlY29yZFNhdmUgPSBhc3luYyAoe3JlY29yZH0pID0+IHtcbiAgICB0aGlzLnJ1blJlcG9ydCh7cmVjb3JkfSk7XG4gIH1cblxuICBydW5SZXBvcnQgPSBhc3luYyAoe3JlY29yZCwgdGVtcGxhdGUsIGhlYWRlciwgZm9vdGVyLCBjb3Zlcn0pID0+IHtcbiAgICBjb25zdCBmaWxlTmFtZSA9IHRoaXMuZmlsZU5hbWUgPT09ICd0aXRsZScgPyByZWNvcmQuZGlzcGxheVZhbHVlIHx8IHJlY29yZC5pZCA6IHJlY29yZC5pZDtcblxuICAgIGNvbnN0IG91dHB1dEZpbGVOYW1lID0gcGF0aC5qb2luKHRoaXMucmVwb3J0UGF0aCwgZmlsZU5hbWUgKyAnLnBkZicpO1xuXG4gICAgaWYgKGZzLmV4aXN0c1N5bmMob3V0cHV0RmlsZU5hbWUpICYmIGZzLnN0YXRTeW5jKG91dHB1dEZpbGVOYW1lKS5zaXplID4gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHBhcmFtcyA9IHtcbiAgICAgIHJlcG9ydE5hbWU6IGZpbGVOYW1lLFxuICAgICAgZGlyZWN0b3J5OiB0aGlzLnJlcG9ydFBhdGgsXG4gICAgICB0ZW1wbGF0ZTogdGVtcGxhdGUgfHwgdGhpcy50ZW1wbGF0ZSxcbiAgICAgIGhlYWRlcjogaGVhZGVyIHx8IHRoaXMuaGVhZGVyLFxuICAgICAgZm9vdGVyOiBmb290ZXIgfHwgdGhpcy5mb290ZXIsXG4gICAgICBjb3ZlcixcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgRGF0ZVV0aWxzOiBjb3JlLkRhdGVVdGlscyxcbiAgICAgICAgcmVjb3JkOiByZWNvcmQsXG4gICAgICAgIHJlbmRlclZhbHVlczogdGhpcy5yZW5kZXJWYWx1ZXMsXG4gICAgICAgIGdldFBob3RvVVJMOiB0aGlzLmdldFBob3RvVVJMXG4gICAgICB9LFxuICAgICAgZWpzT3B0aW9uczoge31cbiAgICB9O1xuXG4gICAgYXdhaXQgdGhpcy5nZW5lcmF0ZVBERihwYXJhbXMpO1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5yZXBlYXRhYmxlcykge1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHJlY29yZC5mb3JtVmFsdWVzLnJlcGVhdGFibGVJdGVtcykge1xuICAgICAgICBjb25zdCByZXBlYXRhYmxlRmlsZU5hbWUgPSB0aGlzLmZpbGVOYW1lID09PSAndGl0bGUnID8gYCR7ZmlsZU5hbWV9IC0gJHtpdGVtLmRpc3BsYXlWYWx1ZX1gIDogaXRlbS5pZDtcblxuICAgICAgICBwYXJhbXMucmVwb3J0TmFtZSA9IHJlcGVhdGFibGVGaWxlTmFtZTtcbiAgICAgICAgcGFyYW1zLmRhdGEucmVjb3JkID0gaXRlbTtcblxuICAgICAgICBhd2FpdCB0aGlzLmdlbmVyYXRlUERGKHBhcmFtcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZ2VuZXJhdGVQREYocGFyYW1zKSB7XG4gICAgY29uc29sZS5sb2coJ0dlbmVyYXRpbmcnLCBwYXJhbXMuZGF0YS5yZWNvcmQuaXNSZWNvcmQgPyAncmVjb3JkJy5ncmVlbiA6ICdjaGlsZCByZWNvcmQnLmdyZWVuLCBwYXJhbXMucmVwb3J0TmFtZSk7XG4gICAgcmV0dXJuIGF3YWl0IFJlcG9ydEdlbmVyYXRvci5nZW5lcmF0ZShwYXJhbXMpO1xuICB9XG5cbiAgZ2V0UGhvdG9VUkwgPSAoaXRlbSkgPT4ge1xuICAgIGlmIChmdWxjcnVtLmFyZ3MubWVkaWFQYXRoKSB7XG4gICAgICByZXR1cm4gcGF0aC5qb2luKGZ1bGNydW0uYXJncy5tZWRpYVBhdGgsICdwaG90b3MnLCBpdGVtLm1lZGlhSUQgKyAnLmpwZycpO1xuICAgIH1cblxuICAgIGNvbnN0IHVybCA9IEFQSUNsaWVudC5nZXRQaG90b1VSTCh0aGlzLmFjY291bnQsIHtpZDogaXRlbS5tZWRpYUlEfSkucmVwbGFjZSgnPycsICcvbGFyZ2U/Jyk7XG5cbiAgICBpZiAodXJsLmluZGV4T2YoJy5qcGcnKSA9PT0gLTEpIHtcbiAgICAgIHJldHVybiB1cmwucmVwbGFjZSgnPycsICcuanBnPycpO1xuICAgIH1cblxuICAgIHJldHVybiB1cmw7XG4gIH1cblxuICByZW5kZXJWYWx1ZXMgPSAoZmVhdHVyZSwgcmVuZGVyRnVuY3Rpb24pID0+IHtcbiAgICByZXR1cm4gdGhpcy5yZW5kZXJWYWx1ZXNSZWN1cnNpdmUoZmVhdHVyZSwgZmVhdHVyZS5mb3JtVmFsdWVzLmNvbnRhaW5lci5lbGVtZW50cywgcmVuZGVyRnVuY3Rpb24pO1xuICB9XG5cbiAgcmVuZGVyVmFsdWVzUmVjdXJzaXZlID0gKGZlYXR1cmUsIGVsZW1lbnRzLCByZW5kZXJGdW5jdGlvbikgPT4ge1xuICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiBlbGVtZW50cykge1xuICAgICAgY29uc3QgZm9ybVZhbHVlID0gZmVhdHVyZS5mb3JtVmFsdWVzLmdldChlbGVtZW50LmtleSk7XG5cbiAgICAgIHJlbmRlckZ1bmN0aW9uKGVsZW1lbnQsIGZvcm1WYWx1ZSk7XG5cbiAgICAgIGlmIChlbGVtZW50LmlzU2VjdGlvbkVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5yZW5kZXJWYWx1ZXNSZWN1cnNpdmUoZmVhdHVyZSwgZWxlbWVudC5lbGVtZW50cywgcmVuZGVyRnVuY3Rpb24pO1xuICAgICAgfSBlbHNlIGlmIChlbGVtZW50LmlzUmVwZWF0YWJsZUVsZW1lbnQpIHtcbiAgICAgICAgbGV0IHNob3VsZFJlY3Vyc2UgPSB0cnVlO1xuXG4gICAgICAgIGlmIChlbGVtZW50LmlzUmVwZWF0YWJsZUVsZW1lbnQgJiYgZnVsY3J1bS5hcmdzLnJlY3Vyc2UgPT09IGZhbHNlKSB7XG4gICAgICAgICAgc2hvdWxkUmVjdXJzZSA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZvcm1WYWx1ZSAmJiBzaG91bGRSZWN1cnNlKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBpdGVtIG9mIGZvcm1WYWx1ZS5pdGVtcykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJWYWx1ZXNSZWN1cnNpdmUoaXRlbSwgZWxlbWVudC5lbGVtZW50cywgcmVuZGVyRnVuY3Rpb24pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19