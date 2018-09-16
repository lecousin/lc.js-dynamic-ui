module.exports = function(grunt) {
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-newer');
	grunt.loadNpmTasks('grunt-contrib-jasmine');
	grunt.initConfig({
		concat: {
			options: {
				sourceMap: 'true',
			},
			dist: {
				src: ['src/main/javascript/**/*.js'],
				dest: 'dist/lc-dynamic-ui.js',
			}
		},
		uglify: {
			options: {
				sourceMap: true
			},
			all: {
				files: {
					'dist/lc-dynamic-ui.min.js': ['dist/lc-dynamic-ui.js']
				}
			}
		},
		jasmine: {
			src: 'src/main/javascript/**/*.js',
			options: {
				specs: 'src/test/specs/**/*.js',
				noSandbox: true
			}
		}
    });
    grunt.registerTask('default', ['jasmine','newer:concat','newer:uglify']);
    grunt.registerTask('release', ['jasmine','concat','uglify']);
};