FROM debian:buster
# To avoid `apt-key output should not be parsed` warning
ENV APT_KEY_DONT_WARN_ON_DANGEROUS_USAGE=DontWarn
# Install dependencies and node
RUN apt-get update && \
  apt-get install -y --no-install-recommends \
  autoconf \
  automake \
  curl \
  default-jre \
  gnupg2 \ 
  libtool-bin \
  # Set up node dependency apt repository
  && curl -sL https://deb.nodesource.com/setup_13.x | bash - \
  # Set up google-chrome dependency apt repository
  && curl -sL https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
  # Install chrome and node
  && apt-get update && apt-get install -y --no-install-recommends \
  google-chrome-stable \
  nodejs \
  && apt-get purge -y --auto-remove automake autoconf curl gnupg2 libtool-bin \
  && rm -rf /var/lib/apt/lists/* \
  && rm -rf /var/cache/apt/archives/*

WORKDIR /usr/src/app
COPY . .
RUN npm install --no-optional ; cd client ; npm install --no-optional ; npm run build ; rm -rf node_modules ; cd ..
ENV PORT=3000
EXPOSE $PORT
CMD [ "npm", "start" ]