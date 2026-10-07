from pathlib import Path
import unittest

from rag.ingestion import load_markdown_chunks, parse_markdown


class MarkdownIngestionTest(unittest.TestCase):
    def test_preserves_heading_hierarchy_and_line_citation(self) -> None:
        chunks = parse_markdown(
            "# Quy tắc\n\n## Đặt phòng\n\nTối đa ba phòng.\n",
            source="customer-policy.md",
        )

        self.assertEqual(1, len(chunks))
        self.assertEqual(("Quy tắc", "Đặt phòng"), chunks[0].heading_path)
        self.assertEqual("Tối đa ba phòng.", chunks[0].content)
        self.assertEqual("customer-policy.md:5-5 (Quy tắc > Đặt phòng)", chunks[0].citation)
        self.assertTrue(chunks[0].id)
        self.assertEqual("paragraph", chunks[0].block_type)
        self.assertEqual(len(chunks[0].content_hash), 64)
        self.assertGreater(chunks[0].token_count, 0)

    def test_starts_a_new_chunk_when_heading_changes(self) -> None:
        chunks = parse_markdown(
            "# Chính sách\n\n## Hủy phòng\n\nMất cọc.\n\n## Thanh toán\n\nDùng VND.\n",
            source="customer-policy.md",
        )

        self.assertEqual(["Chính sách > Hủy phòng", "Chính sách > Thanh toán"], [c.title for c in chunks])

    def test_sibling_level_two_headings_do_not_nest_without_level_one(self) -> None:
        chunks = parse_markdown(
            "## Hủy phòng\n\nMất cọc.\n\n## Thanh toán\n\nDùng VND.\n",
            source="customer-policy.md",
        )

        self.assertEqual(["Hủy phòng", "Thanh toán"], [chunk.title for chunk in chunks])

    def test_keeps_markdown_table_together(self) -> None:
        chunks = parse_markdown(
            "## Phụ thu\n\n| Mốc | Phí |\n|---|---:|\n| 12:21 | 15% |\n",
            source="customer-policy.md",
            max_chars=10,
        )

        self.assertEqual(1, len(chunks))
        self.assertIn("| 12:21 | 15% |", chunks[0].content)

    def test_keeps_bullet_continuations_as_one_structural_block(self) -> None:
        chunks = parse_markdown(
            "## Hỗ trợ\n\n- Một yêu cầu có phần mở đầu\n  và một dòng tiếp tục.\n- Yêu cầu thứ hai.\n",
            source="customer-policy.md",
            target_tokens=10,
            max_tokens=40,
        )

        self.assertEqual(2, len(chunks))
        self.assertEqual("bullet", chunks[0].block_type)
        self.assertIn("và một dòng tiếp tục", chunks[0].content)
        self.assertNotIn("- Yêu cầu thứ hai", chunks[0].content)

    def test_repeats_table_header_when_rows_are_split(self) -> None:
        chunks = parse_markdown(
            "## Phụ thu\n\n| Mốc | Phí |\n|---|---:|\n| 12:20 | Miễn phí |\n| 14:00 | 15% |\n| 16:00 | 20% |\n",
            source="customer-policy.md",
            target_tokens=8,
            max_tokens=14,
        )

        self.assertGreater(len(chunks), 1)
        for chunk in chunks:
            self.assertIn("| Mốc | Phí |", chunk.content)
            self.assertIn("|---|---:|", chunk.content)

    def test_keeps_faq_question_and_answer_together(self) -> None:
        chunks = parse_markdown(
            "## Câu hỏi thường gặp\n\n### Có được nhận phòng sớm không?\n\nKhông, khách sạn không phục vụ nhận phòng sớm.\n",
            source="customer-policy.md",
        )

        self.assertEqual(1, len(chunks))
        self.assertEqual("faq", chunks[0].block_type)
        self.assertIn("Có được nhận phòng sớm không?", chunks[0].content)
        self.assertIn("không phục vụ nhận phòng sớm", chunks[0].content)

    def test_repeated_structures_have_unique_stable_ids(self) -> None:
        chunks = parse_markdown(
            "## Nội quy\n\n- Giữ yên lặng.\n- Giữ yên lặng.\n",
            source="customer-policy.md",
            target_tokens=1,
            max_tokens=10,
        )

        self.assertEqual(2, len(chunks))
        self.assertEqual(2, len({chunk.id for chunk in chunks}))

    def test_loads_the_real_customer_policy_document(self) -> None:
        policy_path = Path(__file__).resolve().parents[2] / "customer-policy.md"

        chunks = load_markdown_chunks(policy_path)

        self.assertGreaterEqual(len(chunks), 8)
        self.assertTrue(any("Trả phòng muộn" in chunk.title for chunk in chunks))
        self.assertTrue(all(chunk.source == "customer-policy.md" for chunk in chunks))

    def test_rejects_non_positive_chunk_size(self) -> None:
        with self.assertRaisesRegex(ValueError, "max_chars must be positive"):
            parse_markdown("Nội dung", source="customer-policy.md", max_chars=0)

    def test_customer_policy_contains_customer_terms_without_internal_rules(self) -> None:
        policy_path = Path(__file__).resolve().parents[2] / "customer-policy.md"

        chunks = load_markdown_chunks(policy_path)
        joined = "\n".join(chunk.content for chunk in chunks).casefold()

        self.assertGreater(len(chunks), 8)
        self.assertNotIn("spring.mail.password", joined)
        self.assertNotIn("vai trò, module và phân quyền", joined)
        self.assertNotIn("khóa sql server", joined)
        self.assertNotIn("hotel_service_bookings", joined)
        self.assertIn("không phục vụ nhận phòng sớm", joined)

    def test_customer_citations_keep_canonical_source_line_numbers(self) -> None:
        policy_path = Path(__file__).resolve().parents[2] / "customer-policy.md"

        late_checkout = next(
            chunk
            for chunk in load_markdown_chunks(policy_path)
            if "Trả phòng muộn" in chunk.title and "12:20" in chunk.text
        )

        self.assertGreater(late_checkout.start_line, 0)
        self.assertIn(f"customer-policy.md:{late_checkout.start_line}-", late_checkout.citation)


if __name__ == "__main__":
    unittest.main()
