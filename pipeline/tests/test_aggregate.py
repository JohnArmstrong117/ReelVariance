import unittest

from pipeline.aggregate import (
    aggregate_rows,
    build_movie_records,
    finance_fields,
    imdb_to_stars,
    language_triples,
    normalize_imdb,
    parse_genres,
    prune_language,
    rating_to_bin,
    tokenize,
)


class AggregateTests(unittest.TestCase):
    def test_imax_and_unlisted_genres_are_dropped(self):
        self.assertEqual(parse_genres("Action|IMAX|Sci-Fi"), ["Action", "Sci-Fi"])
        self.assertEqual(parse_genres("(no genres listed)"), [])
        self.assertEqual(parse_genres("IMAX"), [])

    def test_rating_bins_cover_half_stars(self):
        self.assertEqual([rating_to_bin(stars) for stars in (0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5)], list(range(10)))

    def test_yearly_bins_sum_to_the_lifetime_histogram(self):
        rows = [
            (7, 5.0, 1600000000),
            (7, 0.5, 1600000000),
            (7, 5.0, 1700000000),
            (8, 3.0, 1600000000),
        ]
        lifetime, yearly = aggregate_rows(rows, keep_ids={7})
        self.assertEqual(set(lifetime), {7})
        self.assertEqual(sum(lifetime[7]), 3)
        for index in range(10):
            self.assertEqual(sum(year_bins[index] for year_bins in yearly[7].values()), lifetime[7][index])

    def test_finance_requires_both_budget_and_revenue(self):
        budget, revenue, poster = finance_fields({"budget": 0, "revenue": 50, "poster_path": "/poster.jpg"})
        self.assertEqual((budget, revenue, poster), (None, None, "https://image.tmdb.org/t/p/w342/poster.jpg"))
        budget, revenue, poster = finance_fields({"budget": 20, "revenue": 80, "poster_path": None})
        self.assertEqual((budget, revenue, poster), (20, 80, None))

    def test_imdb_ids_join_across_padding(self):
        self.assertEqual(normalize_imdb("114709"), "tt0114709")
        self.assertEqual(normalize_imdb("0114709"), "tt0114709")
        self.assertEqual(normalize_imdb("tt0114709"), "tt0114709")
        self.assertIsNone(normalize_imdb(""))

    def test_stopwords_and_short_tokens_are_excluded(self):
        stopwords = {"the", "movie", "was", "a"}
        self.assertEqual(tokenize("The movie was a masterpiece!!", stopwords), ["masterpiece"])
        self.assertEqual(tokenize("I don't like it", {"dont", "like"}), [])

    def test_imdb_scores_become_half_star_ratings(self):
        self.assertEqual([imdb_to_stars(score) for score in (1, 2, 3, 10)], [0.5, 1.0, 1.5, 5.0])

    def test_language_counts_a_linked_review_once(self):
        reviews = [
            {"movie_id": "tt0114709", "rating": "10", "review_text": "A masterpiece masterpiece film"},
            {"movie_id": "tt0000001", "rating": "1", "review_text": "A dreadful dreadful film"},
            {"movie_id": "tt0114709", "rating": "nope", "review_text": "masterpiece"},
        ]
        words, movies, used = language_triples(lambda: iter(reviews), {"tt0114709": 1}, {"film"}, min_count=2)
        self.assertEqual(words, ["masterpiece"])
        self.assertEqual(movies, {"1": [[0, 5.0, 2]]})
        self.assertEqual(used, 1)

    def test_prune_keeps_only_words_that_can_reach_the_cloud(self):
        words, movies = prune_language(
            ["rare", "common"],
            {"1": [[0, 1, 1], [1, 1, 50]]},
            {1: ["Horror"]},
            per_slice=1,
        )
        self.assertEqual(words, ["common"])
        self.assertEqual(movies, {"1": [[0, 1, 50]]})

    def test_movie_records_drop_incomplete_histograms(self):
        lifetime = {1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 3]}
        yearly = {1: {2020: [0, 0, 0, 0, 0, 0, 0, 0, 0, 3]}}
        info = {1: {"title": "Toy Story", "year": 1995, "genres": ["Adventure"]}}
        records, year_min, year_max, finance = build_movie_records(
            {1}, lifetime, yearly, info, {1: "tt0114709"},
            {"tt0114709": {"budget": 30, "revenue": 0, "poster_path": "/toy.jpg"}},
            threshold=2,
        )
        self.assertEqual(len(records), 1)
        self.assertIsNone(records[0]["budget"])
        self.assertIsNone(records[0]["poster"])
        self.assertEqual((year_min, year_max, finance), (2020, 2020, 0))
        self.assertEqual(records[0]["title"], "Toy Story")


if __name__ == "__main__":
    unittest.main()
