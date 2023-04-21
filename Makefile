docker-image:
	docker build -t satisfactory-clips-archive/blamehannah:node-latest - < npm.Dockerfile

install:
	docker run --rm \
		-w /var/www \
		-v $(shell pwd)/:/var/www \
		satisfactory-clips-archive/blamehannah:node-latest \
		npm install

audit-fix:
	docker run --rm \
		-w /var/www \
		-v $(shell pwd)/:/var/www \
		satisfactory-clips-archive/blamehannah:node-latest \
		npm audit fix

.PHONY: yt-dlp
yt-dlp:
	docker run --rm \
		-w /var/www \
		-v $(shell pwd)/:/var/www \
		satisfactory-clips-archive/blamehannah:node-latest \
		./node_modules/.bin/gulp yt-dlp

sync-images: yt-dlp
	docker run --rm \
		-w /var/www \
		-v $(shell pwd)/:/var/www \
		satisfactory-clips-archive/blamehannah:node-latest \
		./node_modules/.bin/gulp sync-images

build:
	docker run --rm \
		-w /var/www \
		-v $(shell pwd)/:/var/www \
		satisfactory-clips-archive/blamehannah:node-latest \
		npm run build
