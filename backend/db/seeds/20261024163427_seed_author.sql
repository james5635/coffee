-- +goose Up
SELECT 'up SQL query';
INSERT INTO authors (name, bio) VALUES ('John Doe', 'A brief bio for John Doe');
-- +goose Down
SELECT 'down SQL query';
DELETE FROM authors WHERE name = 'John Doe';