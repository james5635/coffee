-- +goose Up
SELECT 'up SQL query';
CREATE TABLE authors (
  id   BIGSERIAL PRIMARY KEY,
  name text      NOT NULL,
  bio  text
);

-- +goose Down
SELECT 'down SQL query';
DROP TABLE authors;