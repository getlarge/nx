const startVitest = jest.fn().mockResolvedValue({
  results: {
    success: true,
  },
});

const parseCLI = jest.fn().mockReturnValue({
  filter: [],
  options: {},
});

jest.mock('@nx/js/src/internal', () => ({
  ...jest.requireActual('@nx/js/src/internal'),
  registerTsConfigPaths: jest.fn(),
}));

jest.mock('../../utils/options-utils.ts', () => ({
  ...jest.requireActual('../../utils/options-utils.ts'),
  normalizeViteConfigFilePath: jest.fn(() => '/root/vite.config.ts'),
}));

jest.mock('./lib/nx-reporter', () => ({
  NxReporter: jest.fn().mockImplementation(() => {
    return {
      async *[Symbol.asyncIterator]() {
        yield {
          hasErrors: false,
        };
      },
    };
  }),
}));

jest.mock('../../utils/executor-utils', () => ({
  ...jest.requireActual('../../utils/executor-utils'),
  loadVitestDynamicImport: () =>
    Promise.resolve({
      startVitest,
      parseCLI,
    }),

  loadViteDynamicImport: () =>
    Promise.resolve({
      loadConfigFromFile: jest.fn().mockImplementation((...args: any[]) => {
        const path = args[1];
        return {
          config: {
            test: {},
          },
          path,
        };
      }),
      mergeConfig: jest.fn().mockImplementation((...args: any[]) => {
        return {
          configFile: '/root/vite.config.ts',
          watch: false,
          root: relative('/root', joinPathFragments('/root', 'proj')),
        };
      }),
    }),
}));

import { ExecutorContext, joinPathFragments } from '@nx/devkit';
import { relative } from 'path';
import { vitestExecutor } from './vitest.impl';
import { VitestExecutorOptions } from './schema';

describe('Vitest Executor', () => {
  let mockContext: ExecutorContext;
  const defaultOptions: VitestExecutorOptions = {
    testFiles: [],
  };

  beforeEach(async () => {
    mockContext = {
      root: '/root',
      projectName: 'proj',
      projectsConfigurations: {
        version: 2,
        projects: {
          proj: {
            root: 'proj',
            targets: {
              test: {
                executor: '@nx/vite:test',
              },
            },
          },
        },
      },
      nxJsonConfiguration: {},
      target: {
        executor: '@nx/vite:test',
      },
      cwd: '/root',
      isVerbose: true,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  describe('when the vite config file is untouched', () => {
    beforeEach(() => {
      jest.mock(
        '/root/vite.config.ts',
        () => ({
          test: {},
        }),
        { virtual: true }
      );
    });

    it('should send appropriate options to vitest CLI', async () => {
      await vitestExecutor(
        {
          ...defaultOptions,
          configFile: './vite.config.ts',
          watch: false,
        },
        mockContext
      ).next();

      expect(startVitest).toHaveBeenCalledWith(
        'test',
        defaultOptions.testFiles,
        expect.objectContaining({
          configFile: '/root/vite.config.ts',
          reporters: expect.any(Array),
          root: 'proj',
          watch: false,
        })
      );
    });

    it('should send extra options to vitest CLI', async () => {
      await vitestExecutor(
        {
          ...defaultOptions,
          reportsDirectory: 'coverage',
          testFiles: ['test.ts'],
          configFile: './vite.config.js',
          watch: false,
        },
        mockContext
      ).next();

      expect(parseCLI).toHaveBeenCalledWith([
        'vitest',
        '--testFiles=test.ts',
        '--reportsDirectory=coverage',
        '--configFile=./vite.config.js',
        '--watch=false',
      ]);
      expect(startVitest).toHaveBeenCalledWith(
        'test',
        ['test.ts'],
        expect.objectContaining({
          configFile: '/root/vite.config.ts',
          reporters: expect.any(Array),
          root: 'proj',
          watch: false,
        })
      );
    });
  });
});
