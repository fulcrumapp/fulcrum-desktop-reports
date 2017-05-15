'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _async = require('async');

const DEFAULT_CONCURRENCY = 5;

class ConcurrentQueue {
  constructor(worker, concurrency) {
    this.worker = worker;

    this.queue = (0, _async.queue)((task, callback) => {
      this.worker(task).then(callback).catch(callback);
    }, concurrency || DEFAULT_CONCURRENCY);

    this.queue.drain = () => {
      if (this.drainResolver) {
        this.drainResolver();
        this.drainResolver = null;
      }
    };
  }

  push(task, handler) {
    this.queue.push(task, handler);
  }

  drain() {
    return new Promise((resolve, reject) => {
      if (this.queue.idle()) {
        resolve();
      } else {
        this.drainResolver = resolve;
      }
    });
  }
}
exports.default = ConcurrentQueue;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL2NvbmN1cnJlbnQtcXVldWUuanMiXSwibmFtZXMiOlsiREVGQVVMVF9DT05DVVJSRU5DWSIsIkNvbmN1cnJlbnRRdWV1ZSIsImNvbnN0cnVjdG9yIiwid29ya2VyIiwiY29uY3VycmVuY3kiLCJxdWV1ZSIsInRhc2siLCJjYWxsYmFjayIsInRoZW4iLCJjYXRjaCIsImRyYWluIiwiZHJhaW5SZXNvbHZlciIsInB1c2giLCJoYW5kbGVyIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJpZGxlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7QUFFQSxNQUFNQSxzQkFBc0IsQ0FBNUI7O0FBRWUsTUFBTUMsZUFBTixDQUFzQjtBQUNuQ0MsY0FBWUMsTUFBWixFQUFvQkMsV0FBcEIsRUFBaUM7QUFDL0IsU0FBS0QsTUFBTCxHQUFjQSxNQUFkOztBQUVBLFNBQUtFLEtBQUwsR0FBYSxrQkFBTSxDQUFDQyxJQUFELEVBQU9DLFFBQVAsS0FBb0I7QUFDckMsV0FBS0osTUFBTCxDQUFZRyxJQUFaLEVBQWtCRSxJQUFsQixDQUF1QkQsUUFBdkIsRUFBaUNFLEtBQWpDLENBQXVDRixRQUF2QztBQUNELEtBRlksRUFFVkgsZUFBZUosbUJBRkwsQ0FBYjs7QUFJQSxTQUFLSyxLQUFMLENBQVdLLEtBQVgsR0FBbUIsTUFBTTtBQUN2QixVQUFJLEtBQUtDLGFBQVQsRUFBd0I7QUFDdEIsYUFBS0EsYUFBTDtBQUNBLGFBQUtBLGFBQUwsR0FBcUIsSUFBckI7QUFDRDtBQUNGLEtBTEQ7QUFNRDs7QUFFREMsT0FBS04sSUFBTCxFQUFXTyxPQUFYLEVBQW9CO0FBQ2xCLFNBQUtSLEtBQUwsQ0FBV08sSUFBWCxDQUFnQk4sSUFBaEIsRUFBc0JPLE9BQXRCO0FBQ0Q7O0FBRURILFVBQVE7QUFDTixXQUFPLElBQUlJLE9BQUosQ0FBWSxDQUFDQyxPQUFELEVBQVVDLE1BQVYsS0FBcUI7QUFDdEMsVUFBSSxLQUFLWCxLQUFMLENBQVdZLElBQVgsRUFBSixFQUF1QjtBQUNyQkY7QUFDRCxPQUZELE1BRU87QUFDTCxhQUFLSixhQUFMLEdBQXFCSSxPQUFyQjtBQUNEO0FBQ0YsS0FOTSxDQUFQO0FBT0Q7QUE1QmtDO2tCQUFoQmQsZSIsImZpbGUiOiJjb25jdXJyZW50LXF1ZXVlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtxdWV1ZX0gZnJvbSAnYXN5bmMnO1xuXG5jb25zdCBERUZBVUxUX0NPTkNVUlJFTkNZID0gNTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ29uY3VycmVudFF1ZXVlIHtcbiAgY29uc3RydWN0b3Iod29ya2VyLCBjb25jdXJyZW5jeSkge1xuICAgIHRoaXMud29ya2VyID0gd29ya2VyO1xuXG4gICAgdGhpcy5xdWV1ZSA9IHF1ZXVlKCh0YXNrLCBjYWxsYmFjaykgPT4ge1xuICAgICAgdGhpcy53b3JrZXIodGFzaykudGhlbihjYWxsYmFjaykuY2F0Y2goY2FsbGJhY2spO1xuICAgIH0sIGNvbmN1cnJlbmN5IHx8IERFRkFVTFRfQ09OQ1VSUkVOQ1kpO1xuXG4gICAgdGhpcy5xdWV1ZS5kcmFpbiA9ICgpID0+IHtcbiAgICAgIGlmICh0aGlzLmRyYWluUmVzb2x2ZXIpIHtcbiAgICAgICAgdGhpcy5kcmFpblJlc29sdmVyKCk7XG4gICAgICAgIHRoaXMuZHJhaW5SZXNvbHZlciA9IG51bGw7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIHB1c2godGFzaywgaGFuZGxlcikge1xuICAgIHRoaXMucXVldWUucHVzaCh0YXNrLCBoYW5kbGVyKTtcbiAgfVxuXG4gIGRyYWluKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAodGhpcy5xdWV1ZS5pZGxlKCkpIHtcbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5kcmFpblJlc29sdmVyID0gcmVzb2x2ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuIl19