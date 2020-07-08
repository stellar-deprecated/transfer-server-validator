FROM node:14
# To avoid `apt-key output should not be parsed` warning
ENV APT_KEY_DONT_WARN_ON_DANGEROUS_USAGE=DontWarn
# default-jre needs this directory to exist on slim
RUN mkdir -p /usr/share/man/man1
RUN apt-get update && \
  apt-get install -y --no-install-recommends \
  make \
  build-essential \
  python \
  curl \
  default-jre \
  gnupg2 \ 
  nodejs \
  && apt-get purge -y --auto-remove curl gnupg2 \
  && rm -rf /var/lib/apt/lists/* \
  && rm -rf /var/cache/apt/archives/*

WORKDIR /usr/src/app
COPY . .
RUN npm install --no-optional ; cd client ; npm install --no-optional ; npm run build ; rm -rf node_modules ; cd ..
ENV PORT=3000
EXPOSE $PORT
CMD [ "npm", "start" ]