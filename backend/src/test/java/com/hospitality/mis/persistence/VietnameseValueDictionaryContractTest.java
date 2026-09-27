package com.hospitality.mis.persistence;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Runs every API/Java-to-database value mapping published in the CSV against its real converter. */
class VietnameseValueDictionaryContractTest {
    @Test
    void everyPublishedDictionaryMappingMatchesRuntimeConversion() throws Exception {
        List<String> lines = Files.readAllLines(dictionaryPath(), StandardCharsets.UTF_8);
        assertThat(lines).isNotEmpty();
        assertThat(parseRecord(lines.getFirst().replaceFirst("^\\uFEFF", ""))).containsExactly(
                "domain", "javaOrApiValue", "databaseValue", "column", "converter", "maxLength", "notes");

        int checked = 0;
        for (String line : lines.subList(1, lines.size())) {
            if (line.isBlank()) continue;
            List<String> fields = parseRecord(line);
            assertThat(fields).as("CSV row shape: %s", line).hasSize(7);
            String apiValue = fields.get(1);
            String databaseValue = fields.get(2);
            String converter = fields.get(4);
            String description = fields.get(0) + " " + fields.get(3) + " " + apiValue;

            assertThat(convert(converter, apiValue)).as(description).isEqualTo(databaseValue);
            checked++;
        }
        assertThat(checked).isEqualTo(241);
    }

    private static Path dictionaryPath() {
        return List.of(Path.of("..", "docs", "doi-chieu-gia-tri-database.csv"),
                        Path.of("docs", "doi-chieu-gia-tri-database.csv"))
                .stream().filter(Files::isRegularFile).findFirst()
                .orElseThrow(() -> new IllegalStateException("Cannot locate the value dictionary CSV"));
    }

    private static String convert(String converter, String apiValue) throws Exception {
        if (converter.contains("#")) {
            String[] parts = converter.split("#", 2);
            Class<?> owner = Class.forName("com.hospitality.mis.service.reservation." + parts[0]);
            Method method = owner.getDeclaredMethod(parts[1], String.class);
            method.setAccessible(true);
            return (String) method.invoke(null, apiValue);
        }

        Class<?> type = findConverter(converter);
        Object instance = type.getConstructor().newInstance();
        Method method = java.util.Arrays.stream(type.getMethods())
                .filter(candidate -> candidate.getName().equals("convertToDatabaseColumn"))
                .filter(candidate -> candidate.getParameterCount() == 1)
                .filter(candidate -> candidate.getDeclaringClass() != jakarta.persistence.AttributeConverter.class)
                .filter(candidate -> !candidate.isBridge() && !candidate.isSynthetic())
                .findFirst().orElseThrow();
        Class<?> javaType = method.getParameterTypes()[0];
        Object input = javaType == String.class ? apiValue : enumConstant(javaType, apiValue);
        return (String) method.invoke(instance, input);
    }

    private static Class<?> findConverter(String name) throws ClassNotFoundException {
        List<String> candidates = List.of(
                "com.hospitality.mis.persistence.VietnameseCodeConverters$" + name,
                "com.hospitality.mis.persistence.VietnameseEnumConverters$" + name,
                "com.hospitality.mis.dao.room." + name);
        for (String candidate : candidates) {
            try {
                return Class.forName(candidate);
            } catch (ClassNotFoundException ignored) {
                // Check the next owning package.
            }
        }
        throw new ClassNotFoundException("No runtime converter named " + name);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static Object enumConstant(Class<?> type, String name) {
        assertThat(type.isEnum()).as("converter input type %s", type.getName()).isTrue();
        for (Object constant : type.getEnumConstants()) {
            if (((Enum) constant).name().equals(name)) return constant;
            for (String accessor : List.of("databaseCode", "getCode", "getValue")) {
                try {
                    if (name.equals(type.getMethod(accessor).invoke(constant))) return constant;
                } catch (NoSuchMethodException ignored) {
                    // This enum exposes its API code through a different accessor, or only by name.
                } catch (ReflectiveOperationException exception) {
                    throw new IllegalStateException("Cannot read enum API value from " + type.getName(), exception);
                }
            }
        }
        throw new IllegalArgumentException("No enum/API value " + type.getName() + "." + name);
    }

    private static List<String> parseRecord(String line) {
        List<String> values = new ArrayList<>();
        StringBuilder value = new StringBuilder();
        boolean quoted = false;
        for (int index = 0; index < line.length(); index++) {
            char character = line.charAt(index);
            if (character == '"') {
                if (quoted && index + 1 < line.length() && line.charAt(index + 1) == '"') {
                    value.append('"');
                    index++;
                } else {
                    quoted = !quoted;
                }
            } else if (character == ',' && !quoted) {
                values.add(value.toString());
                value.setLength(0);
            } else {
                value.append(character);
            }
        }
        values.add(value.toString());
        return values;
    }
}
